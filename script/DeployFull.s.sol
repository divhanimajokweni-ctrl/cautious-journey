// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {CircuitBreaker}  from "../contracts/CircuitBreaker.sol";
import {AssetRegistry}   from "../contracts/AssetRegistry.sol";
import {TEEVerifier}     from "../contracts/TEEVerifier.sol";

/// @notice Full deployment: CircuitBreaker (MVP) + AssetRegistry + TEEVerifier.
/// @dev    Required env vars:
///           PRIVATE_KEY       deployer private key
///           ORACLE_ADDRESS    oracle address (may be signer)
///           ENCLAVE_ADDRESS   TEE public key (address form)
contract DeployFull is Script {
    function run() external {
        uint256 deployerPk     = vm.envUint("PRIVATE_KEY");
        address oracleAddress  = vm.envAddress("ORACLE_ADDRESS");
        address enclaveAddress = vm.envAddress("ENCLAVE_ADDRESS");

        vm.startBroadcast(deployerPk);

        CircuitBreaker cb = new CircuitBreaker();
        cb.initialize(oracleAddress);
        console.log("CircuitBreaker  :", address(cb));

        AssetRegistry registry = new AssetRegistry();
        console.log("AssetRegistry   :", address(registry));

        TEEVerifier tee = new TEEVerifier(enclaveAddress, address(registry));
        console.log("TEEVerifier     :", address(tee));

        vm.stopBroadcast();

        console.log("---");
        console.log("Oracle          :", oracleAddress);
        console.log("Enclave         :", enclaveAddress);
    }
}
