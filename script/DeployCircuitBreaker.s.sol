// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {CircuitBreaker} from "../contracts/CircuitBreaker.sol";

/// @notice Phase 2 deployment script for Polygon Amoy.
/// @dev    Reads PRIVATE_KEY and ORACLE_ADDRESS from the environment.
///         For the MVP we deploy non-upgradeable. A proxy pattern can be
///         layered on post-PMF without changing the storage layout.
contract DeployCircuitBreaker is Script {
    function run() external {
        uint256 deployerPk    = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");

        vm.startBroadcast(deployerPk);

        CircuitBreaker cb = new CircuitBreaker();
        cb.initialize(oracleAddress);

        vm.stopBroadcast();

        console.log("CircuitBreaker deployed at:", address(cb));
        console.log("Oracle:                    ", oracleAddress);
    }
}
