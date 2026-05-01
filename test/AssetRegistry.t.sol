// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {AssetRegistry} from "../contracts/AssetRegistry.sol";

/// @notice Adversarial coverage for AssetRegistry.
contract AssetRegistryTest is Test {
    AssetRegistry internal registry;

    address internal owner    = address(0xA11CE);
    address internal resetter = address(0xBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant ASSET_A = keccak256("RealT-Detroit-1");
    bytes32 internal constant ASSET_B = keccak256("RealT-Chicago-1");

    uint256 internal constant THRESHOLD = 0.75e18;

    event AssetRegistered(bytes32 indexed assetId, uint256 threshold, address resetter);
    event KernelTripped(bytes32 indexed assetId, uint256 posterior, uint256 threshold);
    event KernelReset(bytes32 indexed assetId, address indexed by);

    function setUp() public {
        vm.prank(owner);
        registry = new AssetRegistry();

        vm.prank(owner);
        registry.registerAsset(ASSET_A, THRESHOLD, resetter);

        vm.prank(owner);
        registry.registerAsset(ASSET_B, THRESHOLD, address(0));
    }

    /*//////////////////////////////////////////////////////////////
                           REGISTRATION
    //////////////////////////////////////////////////////////////*/

    function testRegistrationSetsOpenState() public view {
        assertTrue(registry.isOpen(ASSET_A));
    }

    function testRegistrationEmitsEvent() public {
        bytes32 newId = keccak256("NewAsset");
        vm.expectEmit(true, false, false, true);
        emit AssetRegistered(newId, THRESHOLD, resetter);

        vm.prank(owner);
        registry.registerAsset(newId, THRESHOLD, resetter);
    }

    function testDuplicateRegistrationReverts() public {
        vm.expectRevert(bytes("AR: already registered"));
        vm.prank(owner);
        registry.registerAsset(ASSET_A, THRESHOLD, resetter);
    }

    function testOnlyOwnerCanRegister() public {
        vm.expectRevert(bytes("AR: not owner"));
        vm.prank(stranger);
        registry.registerAsset(keccak256("X"), THRESHOLD, address(0));
    }

    function testBadThresholdReverts() public {
        vm.expectRevert(bytes("AR: bad threshold"));
        vm.prank(owner);
        registry.registerAsset(keccak256("Y"), 0, address(0));

        vm.expectRevert(bytes("AR: bad threshold"));
        vm.prank(owner);
        registry.registerAsset(keccak256("Z"), 1e18 + 1, address(0));
    }

    /*//////////////////////////////////////////////////////////////
                           check() — KERNEL STEP
    //////////////////////////////////////////////////////////////*/

    function testCheckBelowThresholdKeepsOpen() public {
        registry.check(ASSET_A, 0.5e18);
        assertTrue(registry.isOpen(ASSET_A));
    }

    function testCheckAtThresholdTrips() public {
        registry.check(ASSET_A, THRESHOLD);
        assertFalse(registry.isOpen(ASSET_A));
    }

    function testCheckAboveThresholdTrips() public {
        registry.check(ASSET_A, 0.99e18);
        assertFalse(registry.isOpen(ASSET_A));
    }

    function testCheckEmitsKernelTripped() public {
        vm.expectEmit(true, false, false, true);
        emit KernelTripped(ASSET_A, THRESHOLD, THRESHOLD);
        registry.check(ASSET_A, THRESHOLD);
    }

    function testCheckOnHaltedIsNoOp() public {
        registry.check(ASSET_A, THRESHOLD);
        registry.check(ASSET_A, 1e18);
        assertFalse(registry.isOpen(ASSET_A));
    }

    function testCheckUnknownAssetReverts() public {
        vm.expectRevert(bytes("AR: unknown asset"));
        registry.check(keccak256("ghost"), 0.5e18);
    }

    /*//////////////////////////////////////////////////////////////
                              ISOLATION
    //////////////////////////////////////////////////////////////*/

    function testHaltInAssetADoesNotHaltAssetB() public {
        registry.check(ASSET_A, THRESHOLD);
        assertFalse(registry.isOpen(ASSET_A), "A should be halted");
        assertTrue(registry.isOpen(ASSET_B),  "B should remain open");
    }

    /*//////////////////////////////////////////////////////////////
                            assertOpen()
    //////////////////////////////////////////////////////////////*/

    function testAssertOpenPassesWhenOpen() public view {
        registry.assertOpen(ASSET_A);
    }

    function testAssertOpenRevertsWhenHalted() public {
        registry.check(ASSET_A, THRESHOLD);
        vm.expectRevert(bytes("AR: circuit tripped"));
        registry.assertOpen(ASSET_A);
    }

    /*//////////////////////////////////////////////////////////////
                              reset()
    //////////////////////////////////////////////////////////////*/

    function testOwnerCanReset() public {
        registry.check(ASSET_A, THRESHOLD);
        vm.prank(owner);
        registry.reset(ASSET_A);
        assertTrue(registry.isOpen(ASSET_A));
    }

    function testResetterCanReset() public {
        registry.check(ASSET_A, THRESHOLD);
        vm.prank(resetter);
        registry.reset(ASSET_A);
        assertTrue(registry.isOpen(ASSET_A));
    }

    function testStrangerCannotReset() public {
        registry.check(ASSET_A, THRESHOLD);
        vm.expectRevert(bytes("AR: not authorized"));
        vm.prank(stranger);
        registry.reset(ASSET_A);
    }

    function testResetEmitsEvent() public {
        registry.check(ASSET_A, THRESHOLD);
        vm.expectEmit(true, true, false, false);
        emit KernelReset(ASSET_A, owner);
        vm.prank(owner);
        registry.reset(ASSET_A);
    }

    function testResetClearsPosterior() public {
        registry.check(ASSET_A, 0.99e18);
        vm.prank(owner);
        registry.reset(ASSET_A);
        (,uint256 posterior,,,) = registry.kernels(ASSET_A);
        assertEq(posterior, 0);
    }

    /*//////////////////////////////////////////////////////////////
                         setThreshold()
    //////////////////////////////////////////////////////////////*/

    function testOwnerCanUpdateThreshold() public {
        vm.prank(owner);
        registry.setThreshold(ASSET_A, 0.9e18);
        (,,uint256 t,,) = registry.kernels(ASSET_A);
        assertEq(t, 0.9e18);
    }

    function testNonOwnerCannotUpdateThreshold() public {
        vm.expectRevert(bytes("AR: not owner"));
        vm.prank(stranger);
        registry.setThreshold(ASSET_A, 0.9e18);
    }
}
