// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal stub of the RealT token mock used for integration demos.
/// This contract is only required to compile the deployment scripts and tests.
/// It is not used in the production deployment path.
contract MockRealT {
    bytes32 public assetId;
    bytes32 public expectedDeedHash;
    address public proofHook;
    address public holder;

    constructor(
        bytes32 _assetId,
        bytes32 _expectedDeedHash,
        address _proofHook,
        address _initialHolder,
        uint256 _initialSupply
    ) {
        assetId = _assetId;
        expectedDeedHash = _expectedDeedHash;
        proofHook = _proofHook;
        holder = _initialHolder;
        // In a full mock you'd mint tokens to holder here.
    }
}
