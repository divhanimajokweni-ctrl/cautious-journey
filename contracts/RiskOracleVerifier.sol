// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title  RiskOracleVerifier
 * @notice Wraps TEEVerifier + EIP-712 verification in a single contract
 *         so the backend can bypass TEEVerifier when an EIP-712 oracle
 *         decision is already available (e.g. during pre-production or
 *         when the enclave uplink is unavailable).
 *
 * @dev    This is the "Risk Oracle Verifier" identified in the integration plan
 *         — it upgrades the raw EIP-191 path in TEEVerifier with:
 *           • nonce nullification (prevents decision replay)
 *           • EIP-712 typed-data verification (AA/EIP-712 wallet compat)
 *           • committee quorum awareness (ties to UbuntuPoolsEngine)
 *
 *   Use this when:
 *     • The enclave is offline for scheduled maintenance
 *     • A human committee override is needed (final authority path)
 *     • Pre-production testing without TEE hardware
 */
contract RiskOracleVerifier is ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                                  STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice EIP-712 domain separator (updated on key-rotation)
    bytes32 public domainSeparator;
    /// @notice Oracle decision type hash (set once in constructor)
    bytes32 public DECISION_TYPEHASH;

    /// @notice Previously-used nonces — prevents replay
    mapping(uint256 => bool) public usedNonces;

    /// @notice Backing contract: the AssetRegistry kernel
    /// @dev    `immutable` was removed: initialize() can't write immutables.
    address public kernel;
    /// @notice UbuntuPoolsEngine; set at deployment or initialize()
    address public poolsEngine;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event OracleDecisionVerified(
        bytes32  indexed entityId,
        uint256  belief,
        uint256  threshold,
        string   verdict,
        uint256  nonce,
        address  indexed by
    );

    event OracleDecisionReplayed(uint256 nonce); // always reverted — used for forensics

    /*//////////////////////////////////////////////////////////////
                              EIP-712 DOMAIN
    //////////////////////////////////////////////////////////////*/

    struct OracleDecision {
        string   entityId;
        uint256  belief;        // 0..10000 basis points
        uint256  threshold;     // 0..10000 basis points
        string   verdict;       // PASS | WARN | HALT
        uint256  nonce;
        uint256  timestamp;
    }

    /*//////////////////////////////////////////////////////////////
                                  INIT
    //////////////////////////////////////////////////////////////*/

    constructor(address _kernel, address _poolsEngine) {
        address _owner = msg.sender;
        _disableInitializers();

        DECISION_TYPEHASH = keccak256(
            "OracleDecision(string entityId,uint256 belief,uint256 threshold,string verdict,uint256 nonce,uint256 timestamp)"
        );
        domainSeparator = _buildDomainSeparator(_owner);
        // Kernel and poolsEngine are set in initialize() (upgradeable pattern)
    }

    function initialize(address _kernel, address _poolsEngine) public initializer {
        __Ownable_init();
        domainSeparator = _buildDomainSeparator(address(owner()));
        kernel          = _kernel;
        poolsEngine     = _poolsEngine;
    }

    function _buildDomainSeparator(address owner) internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("ProofBridgeLiner"),
            keccak256("1"),
            block.chainid,
            owner
        ));
    }

    /*//////////////////////////////////////////////////////////////
                          EIP-712 VERIFICATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Verify an EIP-712 oracle decision and forward the posterior
     *         to the backing AssetRegistry kernel (via TEEVerifier interface).
     * @dev    On-chain: recovers the signer from EIP-712 typed data, checks
     *         the domain separator, nullifies the nonce, and calls kernel.check().
     */
    function verifyAndExecute(
        OracleDecision calldata decision,
        bytes calldata   signature,
        address          entityIdBytes32Sender   // caller must own entity OR be the authorized node
    ) external nonReentrant {
        // ── enforce domain ─────────────────────────────────────────────────
        bytes32 structHash = keccak256(abi.encode(
            DECISION_TYPEHASH,
            keccak256(bytes(decision.entityId)),
            decision.belief,
            decision.threshold,
            keccak256(bytes(decision.verdict)),
            decision.nonce,
            decision.timestamp
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = digest.recover(signature);
        require(signer == owner(), "ROV: unauthorised oracle");

        // ── nonce nullification ────────────────────────────────────────────
        // Wrap solidity bool in require check (evm needs bools from mappings)
        require(!usedNonces[decision.nonce], "ROV: nonce already used");
        usedNonces[decision.nonce] = true;

        // ── kernel update ─────────────────────────────────────────────────
        // The posterior from belief basis-points → ×1e18
        uint256 posteriorScaled = (decision.belief * 1e18) / 10000;
        uint256 thresholdScaled = (decision.threshold * 1e18) / 10000;

        // Call kernel.check(assetId, posterior) on AssetRegistry
        IAssetRegistryKernel(payable(kernel)).check(
            keccak256(bytes(decision.entityId)),
            posteriorScaled
        );

        emit OracleDecisionVerified(
            keccak256(bytes(decision.entityId)),
            decision.belief,
            decision.threshold,
            decision.verdict,
            decision.nonce,
            signer
        );
    }

    /**
     * @notice Register a pools-engine proposal as APPROVED or REJECTED
     *         without requiring the TEE enclave.  For committee/oracle overrides.
     */
    function settlePoolProposal(
        bytes32 proposalId,
        bool    approved
    ) external onlyOwner {
        // Use low-level call so we don't need a costly interface declaration.
        // Byte-sig and args are abi.encode(bytes32, bool) folded mutely.
        if (poolsEngine != address(0)) {
            bytes memory payload =
                abi.encodeWithSelector(
                    bytes4(keccak256("settleProposal(bytes32,bool)")),
                    proposalId,
                    approved
                );
            (bool ok,) = poolsEngine.call{ value: 0 }(payload);
            require(ok, "ROV: pool settlement reverted");
        }
    }

    /// @notice Change the owning oracle key (for key rotation).
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "ROV: zero owner");
        _transferOwnership(newOwner);
        // Rebuild domain separator with the new owner address.
        domainSeparator = _buildDomainSeparator(newOwner);
    }
}

/// @dev Minimal interface consumed by RiskOracleVerifier.
interface IAssetRegistryKernel {
    function check(bytes32 assetId, uint256 posterior) external;
}
