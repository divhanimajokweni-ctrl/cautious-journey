// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./SafetyKernel.sol";

contract SafeERC20 is ERC20 {
    SafetyKernel public kernel;

    constructor(string memory name, string memory symbol, address _kernel) ERC20(name, symbol) {
        kernel = SafetyKernel(_kernel);
        _mint(msg.sender, 1000000 * 10**decimals()); // mint for testing
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        kernel.assertOpen();
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        kernel.assertOpen();
        return super.transferFrom(from, to, amount);
    }
}