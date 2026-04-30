// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MockRealT} from "../contracts/mock/MockRealT.sol";

contract DeployMockRealT is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        bytes32 assetId = 0x9f3e2a1b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f;
        bytes32 expectedDeedHash = 0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed;
        address proofHook = 0x770342c49e1F4710E0Eed605dCe41e7f3F7600Eb;
        address initialHolder = 0x49A1ba2Bde61B96685385F4Ce012586A518c3E70;
        uint256 initialSupply = 1000000000000000000; // 1 token

        vm.startBroadcast(deployerPk);

        MockRealT mock = new MockRealT(assetId, expectedDeedHash, proofHook, initialHolder, initialSupply);

        vm.stopBroadcast();

        console.log("MockRealT deployed at:", address(mock));
    }
}