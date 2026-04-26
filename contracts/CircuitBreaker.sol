// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IProofHook} from "./IProofHook.sol";

/// @title  CircuitBreaker
/// @notice Ghost-Risk Circuit-Breaker for tokenised real-world assets.
/// @dev    MVP trust model:
///           - A single `oracle` address may push deed hashes and trip the circuit.
///           - The contract `owner` may reset the circuit after a trip.
///         Future versions will replace `onlyOracle` with EIP-712 quorum
///         signature verification (3-of-5 ECDSA).
contract CircuitBreaker is IProofHook {
    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice The address that may reset the circuit.
    address public owner;

    /// @notice The address that may push proofs and trip the circuit.
    address public oracle;

    /// @notice Global circuit state. `true` = open (transfers allowed).
    bool public circuitOpen;

    /// @notice Latest committed deed-hash per asset id.
    mapping(bytes32 => bytes32) public latestProof;

    /// @notice Initialisation guard.
    bool private _initialized;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Initialized(address indexed owner, address indexed oracle);
    event ProofUpdated(bytes32 indexed assetId, bytes32 deedHash, uint256 timestamp);
    event CircuitTripped(address indexed by, string reason, uint256 timestamp);
    event CircuitReset(address indexed by, uint256 timestamp);

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "CB: not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "CB: not oracle");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              INITIALISATION
    //////////////////////////////////////////////////////////////*/

    /// @notice One-shot initialiser. The deployer becomes `owner`.
    /// @param _oracle The single trusted oracle address for the MVP.
    function initialize(address _oracle) external {
        require(!_initialized, "CB: already initialized");
        require(_oracle != address(0), "CB: oracle=0");
        _initialized = true;
        owner = msg.sender;
        oracle = _oracle;
        circuitOpen = true;
        emit Initialized(msg.sender, _oracle);
    }

    /*//////////////////////////////////////////////////////////////
                              ORACLE WRITES
    //////////////////////////////////////////////////////////////*/

    /// @notice Commit a fresh deed-hash for `assetId`.
    /// @dev    The MVP does not verify a quorum signature; this is the
    ///         documented trust assumption.
    function updateProof(bytes32 assetId, bytes32 deedHash) external onlyOracle {
        latestProof[assetId] = deedHash;
        emit ProofUpdated(assetId, deedHash, block.timestamp);
    }

    /// @notice Trip the global circuit, halting all gated transfers.
    function tripCircuit(string calldata reason) external onlyOracle {
        circuitOpen = false;
        emit CircuitTripped(msg.sender, reason, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                                OWNER WRITES
    //////////////////////////////////////////////////////////////*/

    /// @notice Re-open the circuit after a trip. Owner-gated.
    function reset() external onlyOwner {
        circuitOpen = true;
        emit CircuitReset(msg.sender, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                                  READS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IProofHook
    function validate(bytes32 assetId, bytes32 expectedHash) external view returns (bool) {
        require(circuitOpen, "CB: circuit tripped");
        return latestProof[assetId] == expectedHash;
    }
}
