// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IProofHook
/// @notice Minimal interface that any ERC-20 (or other token) integrates
///         in its `_beforeTokenTransfer` hook to guard against ghost-risk.
/// @dev    The token contract holds a reference to a CircuitBreaker and
///         calls `validate(assetId, expectedHash)` before each transfer.
interface IProofHook {
    /// @notice Returns true iff the circuit is open AND the on-chain proof
    ///         for `assetId` matches `expectedHash`. Reverts if the circuit
    ///         has been tripped for `assetId`.
    function validate(bytes32 assetId, bytes32 expectedHash) external view returns (bool);

    /// @notice The latest deed-hash committed for `assetId` by the oracle.
    function latestProof(bytes32 assetId) external view returns (bytes32);

    /// @notice Whether the global circuit is open (true) or tripped (false).
    function circuitOpen() external view returns (bool);
}
