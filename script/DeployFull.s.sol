// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {CircuitBreaker}  from "../contracts/CircuitBreaker.sol";
import {AssetRegistry}   from "../contracts/AssetRegistry.sol";
import {TEEVerifier}     from "../contracts/TEEVerifier.sol";

/// @notice Full institution-grade deployment: CircuitBreaker + AssetRegistry + TEEVerifier.
/// @dev    Required env vars:
///           PRIVATE_KEY              deployer private key
///           ORACLE_ADDRESS           MVP single-oracle address (for CircuitBreaker)
///           ENCLAVE_ADDRESS          TEE public key (address form)
///
///         Optional:
///           CIRCUIT_BREAKER_ADDRESS  skip CircuitBreaker deploy if already deployed
contract DeployFull is Script {
    function run() external {
        uint256 deployerPk     = vm.envUint("PRIVATE_KEY");
        address oracleAddress  = vm.envAddress("ORACLE_ADDRESS");
        address enclaveAddress = vm.envAddress("ENCLAVE_ADDRESS");

        vm.startBroadcast(deployerPk);

        // 1. CircuitBreaker (MVP single-oracle, Phase 2)
        CircuitBreaker cb = new CircuitBreaker();
        cb.initialize(oracleAddress);
        console.log("CircuitBreaker :", address(cb));

        // 2. AssetRegistry (multi-asset isolated kernels, institution-grade)
        AssetRegistry registry = new AssetRegistry();
        console.log("AssetRegistry  :", address(registry));

        // 3. TEEVerifier (input-admissibility bridge)
        TEEVerifier teeVerifier = new TEEVerifier(enclaveAddress, address(registry));
        console.log("TEEVerifier    :", address(teeVerifier));

        vm.stopBroadcast();

        console.log("---");
        console.log("Oracle         :", oracleAddress);
        console.log("Enclave        :", enclaveAddress);
    }
}
