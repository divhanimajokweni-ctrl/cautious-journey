// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {RiskOracleVerifier} from "../contracts/RiskOracleVerifier.sol";

/// @notice Deploy RiskOracleVerifier to Polygon Amoy.
/// @dev    Upgradeable pattern (constructor disables v2-initializer to
///         allow proxy deployment). For straight (non-proxy) deploy, call
///         _disableInitializers() in constructor and initialize() via
///         low-level call or direct transaction immediately after deploy.
///
///   Env vars required:
///     PRIVATE_KEY               deployer private key
///     ORACLE_PUBLIC_KEY         EIP-712 oracle signing address (signer)
///     POOLS_ENGINE_ADDRESS      UbuntuPoolsEngine address (required before amoy set)
///
///   Pre-requisite:
///     UbuntuPoolsEngine must already be deployed. Paste its address into
///     the POOLS_ENGINE_ADDRESS env var before running this script.
///
///   Output:
///     console.log("RiskOracleVerifier deployed at: 0x...")
///     → paste into Vercel env var CONTRACT_ADDRESS
contract DeployRiskOracleVerifier is Script {
    function run() external {
        uint256 deployerPk         = vm.envUint("PRIVATE_KEY");
        address kernelAddress      = vm.envAddress("ORACLE_PUBLIC_KEY");
        address poolsEngineAddress = vm.envAddress("POOLS_ENGINE_ADDRESS");

        require(kernelAddress != address(0),      "ROV: kernel address required");
        require(poolsEngineAddress != address(0), "ROV: poolsEngine address required");

        vm.startBroadcast(deployerPk);

        RiskOracleVerifier rov = new RiskOracleVerifier(kernelAddress, poolsEngineAddress);

        vm.stopBroadcast();

        console.log("RiskOracleVerifier deployed at:", address(rov));
        console.log("Deployer/owner:                 ", address(rov));
        console.log("Kernel/AssetRegistry:           ", kernelAddress);
        console.log("UbuntuPoolsEngine:              ", poolsEngineAddress);
    }
}
