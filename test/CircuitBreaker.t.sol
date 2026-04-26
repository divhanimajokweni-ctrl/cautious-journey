// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CircuitBreaker} from "../contracts/CircuitBreaker.sol";

/// @notice Adversarial coverage matrix for CircuitBreaker.
///         Every modifier and every state transition is exercised
///         with both happy-path and failing inputs.
contract CircuitBreakerTest is Test {
    CircuitBreaker internal cb;

    address internal owner   = address(0xA11CE);
    address internal oracle  = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant ASSET_ID    = keccak256("RealT-Detroit-Property-1");
    bytes32 internal constant DEED_HASH_A = keccak256("deed:A");
    bytes32 internal constant DEED_HASH_B = keccak256("deed:B");

    // Mirror of the contract events for vm.expectEmit.
    event Initialized(address indexed owner, address indexed oracle);
    event ProofUpdated(bytes32 indexed assetId, bytes32 deedHash, uint256 timestamp);
    event CircuitTripped(address indexed by, string reason, uint256 timestamp);
    event CircuitReset(address indexed by, uint256 timestamp);

    function setUp() public {
        vm.prank(owner);
        cb = new CircuitBreaker();
        vm.prank(owner);
        cb.initialize(oracle);
    }

    /*//////////////////////////////////////////////////////////////
                              INITIALISATION
    //////////////////////////////////////////////////////////////*/

    function testInitializeSetsOwnerAndOracle() public {
        assertEq(cb.owner(), owner);
        assertEq(cb.oracle(), oracle);
        assertTrue(cb.circuitOpen());
    }

    function testInitializeRevertsOnSecondCall() public {
        vm.expectRevert(bytes("CB: already initialized"));
        cb.initialize(oracle);
    }

    /*//////////////////////////////////////////////////////////////
                              updateProof
    //////////////////////////////////////////////////////////////*/

    function testUpdateProofByOracle() public {
        vm.prank(oracle);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
        assertEq(cb.latestProof(ASSET_ID), DEED_HASH_A);
    }

    function testUpdateProofEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ProofUpdated(ASSET_ID, DEED_HASH_A, block.timestamp);
        vm.prank(oracle);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
    }

    function testUpdateProofRevertsIfNotOracle() public {
        vm.expectRevert(bytes("CB: not oracle"));
        vm.prank(stranger);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
    }

    /*//////////////////////////////////////////////////////////////
                              tripCircuit
    //////////////////////////////////////////////////////////////*/

    function testTripCircuitByOracle() public {
        vm.prank(oracle);
        cb.tripCircuit("ipfs unreachable");
        assertFalse(cb.circuitOpen());
    }

    function testTripCircuitEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit CircuitTripped(oracle, "ipfs unreachable", block.timestamp);
        vm.prank(oracle);
        cb.tripCircuit("ipfs unreachable");
    }

    function testTripCircuitRevertsIfNotOracle() public {
        vm.expectRevert(bytes("CB: not oracle"));
        vm.prank(stranger);
        cb.tripCircuit("nope");
    }

    /*//////////////////////////////////////////////////////////////
                                validate
    //////////////////////////////////////////////////////////////*/

    function testValidateWhenOpenAndHashMatches() public {
        vm.prank(oracle);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
        assertTrue(cb.validate(ASSET_ID, DEED_HASH_A));
    }

    function testValidateWhenOpenAndHashDoesNotMatch() public {
        vm.prank(oracle);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
        assertFalse(cb.validate(ASSET_ID, DEED_HASH_B));
    }

    function testValidateRevertsWhenCircuitTripped() public {
        vm.prank(oracle);
        cb.updateProof(ASSET_ID, DEED_HASH_A);
        vm.prank(oracle);
        cb.tripCircuit("manual");
        vm.expectRevert(bytes("CB: circuit tripped"));
        cb.validate(ASSET_ID, DEED_HASH_A);
    }

    /*//////////////////////////////////////////////////////////////
                                  reset
    //////////////////////////////////////////////////////////////*/

    function testResetByOwner() public {
        vm.prank(oracle);
        cb.tripCircuit("manual");
        assertFalse(cb.circuitOpen());
        vm.prank(owner);
        cb.reset();
        assertTrue(cb.circuitOpen());
    }

    function testResetEmitsEvent() public {
        vm.prank(oracle);
        cb.tripCircuit("manual");
        vm.expectEmit(true, false, false, true);
        emit CircuitReset(owner, block.timestamp);
        vm.prank(owner);
        cb.reset();
    }

    function testResetRevertsIfNotOwner() public {
        vm.prank(oracle);
        cb.tripCircuit("manual");
        vm.expectRevert(bytes("CB: not owner"));
        vm.prank(stranger);
        cb.reset();
    }
}
