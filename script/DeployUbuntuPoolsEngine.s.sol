// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {UbuntuPoolsEngine} from "../contracts/UbuntuPoolsEngine.sol";

/// @notice Deploy UbuntuPoolsEngine to Polygon Amoy.
/// @dev    Non-upgradeable. Pass the same PRIVATE_KEY used for broadcast.
///
///   Committee & quorum:
///     Replace the placeholder committee addresses below with the 5-of-X
///     real committee members before broadcasting. Quorum = number of
///     confirmations required to approve a proposal (e.g. 3-of-5).
///
///   Env vars required:
///     PRIVATE_KEY    deployer private key
///
///   Output:
///     console.log("UbuntuPoolsEngine deployed at: 0x...")
///     → paste into Vercel env var POOLS_ENGINE_ADDRESS
contract DeployUbuntuPoolsEngine is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        // ── Committee addresses (update before broadcast) ─────────────────────
        address[] memory committee = new address[](5);
        // committee[0] = 0x0000000000000000000000000000000000000000;
        // committee[1] = 0x0000000000000000000000000000000000000000;
        // committee[2] = 0x0000000000000000000000000000000000000000;
        // committee[3] = 0x0000000000000000000000000000000000000000;
        // committee[4] = 0x0000000000000000000000000000000000000000;

        uint256 quorum = 3; // 3-of-5

        vm.startBroadcast(deployerPk);

        UbuntuPoolsEngine engine = new UbuntuPoolsEngine(committee, quorum);

        vm.stopBroadcast();

        console.log("UbuntuPoolsEngine deployed at:", address(engine));
        console.log("Committee size:               ", committee.length);
        console.log("Quorum:                       ", quorum);
    }
}
