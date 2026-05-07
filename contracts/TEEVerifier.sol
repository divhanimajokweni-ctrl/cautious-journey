// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

<<<<<<< HEAD
/// @title  TEEVerifier
/// @notice Input-admissibility layer for the proofBRIDGE-liner.
/// @dev    Only data signed by the registered enclave key may influence the
///         AssetRegistry kernel.  This enforces the TEE attestation bridge
///         described in the institution-grade specification.
///
///         Signature scheme: EIP-191 personal_sign over
///           keccak256(abi.encodePacked(docHash, posterior, threshold))
contract TEEVerifier {
    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Immutable enclave key.  Only the enclave can produce valid sigs.
    address public immutable enclavePublicKey;

    /// @notice The AssetRegistry kernel that this verifier feeds into.
    IAssetRegistryKernel public immutable kernel;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event AttestationVerified(
        bytes32 indexed docHash,
        uint256 posterior,
        uint256 threshold,
        address indexed caller
    );

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _enclave  The TEE's ECDSA public key (Ethereum address form).
    /// @param _kernel   The AssetRegistry contract.
    constructor(address _enclave, address _kernel) {
        require(_enclave != address(0), "TEE: enclave=0");
        require(_kernel  != address(0), "TEE: kernel=0");
        enclavePublicKey = _enclave;
        kernel = IAssetRegistryKernel(_kernel);
    }

    /*//////////////////////////////////////////////////////////////
                               CORE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Verify the TEE attestation and, if valid, call the kernel.
    /// @param assetId   The asset being checked.
    /// @param docHash   The document hash attested by the TEE.
    /// @param signature EIP-191 signature from the enclave over (docHash, posterior, threshold).
    /// @param posterior Bayesian posterior probability (scaled ×1e18).
    /// @param threshold Trip threshold (scaled ×1e18).
    function verifyAndExecute(
        bytes32 assetId,
        bytes32 docHash,
        bytes calldata signature,
        uint256 posterior,
        uint256 threshold
    ) external {
        bytes32 message = keccak256(abi.encodePacked(docHash, posterior, threshold));
        require(
            _recoverSigner(message, signature) == enclavePublicKey,
            "TEE: INVALID_ATTESTATION"
        );

        emit AttestationVerified(docHash, posterior, threshold, msg.sender);

        kernel.check(assetId, posterior);
    }

    /*//////////////////////////////////////////////////////////////
                              SIGNATURE UTIL
    //////////////////////////////////////////////////////////////*/

    function _recoverSigner(bytes32 message, bytes calldata sig)
        internal
        pure
        returns (address)
    {
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        (bytes32 r, bytes32 s, uint8 v) = _split(sig);
        return ecrecover(ethHash, v, r, s);
    }

    function _split(bytes calldata sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "TEE: bad sig length");
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }
}

/// @dev Minimal interface consumed by TEEVerifier.
interface IAssetRegistryKernel {
    function check(bytes32 assetId, uint256 posterior) external;
}
=======
import "./SafetyKernel.sol";

contract TEEVerifier {
    SafetyKernel public kernel;
    bytes32 public expectedPCRHash;

    constructor(address _kernel, bytes32 _expectedHash) {
        kernel = SafetyKernel(_kernel);
        expectedPCRHash = _expectedHash;
    }

    function verify(bytes calldata attestation) external {
        bytes32 hash = keccak256(attestation);
        if (hash != expectedPCRHash) {
            // Force halt: call check with posteriorScaled = 0, threshold = 8000
            kernel.check(0, 8000);
        }
        // If match, do nothing, allow normal check
    }
}
>>>>>>> 0e846a22630dd7d830ec1009e45376be9f384fd8
