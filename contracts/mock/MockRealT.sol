// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IProofHook} from "../IProofHook.sol";

/// @title  MockRealT
/// @notice Minimal ERC-20-style mock that demonstrates the
///         5-line `_beforeTokenTransfer` integration with CircuitBreaker.
/// @dev    Not a full ERC-20 implementation; only the surface needed
///         to demo the ghost-risk hook end-to-end.
contract MockRealT {
    string public constant name = "Mock RealT";
    string public constant symbol = "mREALT";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    /// @notice The single asset id this token represents.
    bytes32 public assetId;

    /// @notice The deed hash this token expects to match on every transfer.
    bytes32 public expectedDeedHash;

    /// @notice The CircuitBreaker contract this token is gated by.
    IProofHook public proofHook;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(
        bytes32 _assetId,
        bytes32 _expectedDeedHash,
        address _proofHook,
        address _initialHolder,
        uint256 _initialSupply
    ) {
        assetId = _assetId;
        expectedDeedHash = _expectedDeedHash;
        proofHook = IProofHook(_proofHook);
        totalSupply = _initialSupply;
        balanceOf[_initialHolder] = _initialSupply;
        emit Transfer(address(0), _initialHolder, _initialSupply);
    }

    /// @notice The 5-line ghost-risk gate. This is the entire integration cost.
    function _beforeTokenTransfer(address /*from*/, address /*to*/, uint256 /*amount*/) internal view {
        // 1. Ask the circuit breaker.
        bool ok = proofHook.validate(assetId, expectedDeedHash);
        // 2. Reject any mismatch.
        require(ok, "MockRealT: ghost-risk detected");
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _beforeTokenTransfer(msg.sender, to, amount);
        require(balanceOf[msg.sender] >= amount, "MockRealT: balance");
        unchecked {
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
