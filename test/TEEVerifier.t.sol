// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {TEEVerifier}   from "../contracts/TEEVerifier.sol";
import {AssetRegistry} from "../contracts/AssetRegistry.sol";

/// @notice Adversarial coverage for TEEVerifier.
contract TEEVerifierTest is Test {
    AssetRegistry internal registry;
    TEEVerifier   internal verifier;

    uint256 internal enclavePk;
    address internal enclaveAddr;

    bytes32 internal constant ASSET_ID  = keccak256("RealT-Detroit-Property-1");
    bytes32 internal constant DOC_HASH  = keccak256("deed:v1");
    uint256 internal constant THRESHOLD = 0.75e18;

    function setUp() public {
        enclavePk   = 0xA11CE_BEEF_CAFE_1234_5678_9ABC_DEF0_1234_5678_9ABC_DEF0_1234_5678_9A;
        enclaveAddr = vm.addr(enclavePk);

        registry = new AssetRegistry();
        registry.registerAsset(ASSET_ID, THRESHOLD, address(0));

        verifier = new TEEVerifier(enclaveAddr, address(registry));
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR GUARDS
    //////////////////////////////////////////////////////////////*/

    function testRejectsZeroEnclave() public {
        vm.expectRevert(bytes("TEE: enclave=0"));
        new TEEVerifier(address(0), address(registry));
    }

    function testRejectsZeroKernel() public {
        vm.expectRevert(bytes("TEE: kernel=0"));
        new TEEVerifier(enclaveAddr, address(0));
    }

    /*//////////////////////////////////////////////////////////////
                          HAPPY-PATH: BELOW THRESHOLD
    //////////////////////////////////////////////////////////////*/

    function testValidAttestationBelowThresholdKeepsOpen() public {
        uint256 posterior = 0.5e18;
        bytes memory sig  = _sign(DOC_HASH, posterior, THRESHOLD);

        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, posterior, THRESHOLD);

        assertTrue(registry.isOpen(ASSET_ID), "should remain open");
    }

    /*//////////////////////////////////////////////////////////////
                          HAPPY-PATH: AT/ABOVE THRESHOLD
    //////////////////////////////////////////////////////////////*/

    function testValidAttestationAtThresholdTrips() public {
        uint256 posterior = THRESHOLD;
        bytes memory sig  = _sign(DOC_HASH, posterior, THRESHOLD);

        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, posterior, THRESHOLD);

        assertFalse(registry.isOpen(ASSET_ID), "should be tripped");
    }

    function testValidAttestationAboveThresholdTrips() public {
        uint256 posterior = 0.99e18;
        bytes memory sig  = _sign(DOC_HASH, posterior, THRESHOLD);

        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, posterior, THRESHOLD);

        assertFalse(registry.isOpen(ASSET_ID), "should be tripped");
    }

    /*//////////////////////////////////////////////////////////////
                         ADVERSARIAL: BAD SIGNATURE
    //////////////////////////////////////////////////////////////*/

    function testInvalidSignatureReverts() public {
        uint256 wrongPk  = 0xDEAD_BEEF_0000_1111;
        bytes memory sig = _signWith(wrongPk, DOC_HASH, 0.5e18, THRESHOLD);

        vm.expectRevert(bytes("TEE: INVALID_ATTESTATION"));
        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, 0.5e18, THRESHOLD);
    }

    function testTamperedPosteriorReverts() public {
        bytes memory sig = _sign(DOC_HASH, 0.5e18, THRESHOLD);

        vm.expectRevert(bytes("TEE: INVALID_ATTESTATION"));
        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, 0.9e18, THRESHOLD);
    }

    function testTamperedDocHashReverts() public {
        bytes memory sig = _sign(DOC_HASH, 0.5e18, THRESHOLD);

        vm.expectRevert(bytes("TEE: INVALID_ATTESTATION"));
        verifier.verifyAndExecute(
            ASSET_ID,
            keccak256("deed:tampered"),
            sig,
            0.5e18,
            THRESHOLD
        );
    }

    function testBadSigLengthReverts() public {
        bytes memory badSig = new bytes(32);

        vm.expectRevert(bytes("TEE: bad sig length"));
        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, badSig, 0.5e18, THRESHOLD);
    }

    /*//////////////////////////////////////////////////////////////
                          EVENT EMISSION
    //////////////////////////////////////////////////////////////*/

    function testEmitsAttestationVerified() public {
        uint256 posterior = 0.5e18;
        bytes memory sig  = _sign(DOC_HASH, posterior, THRESHOLD);

        vm.expectEmit(true, false, false, true);
        emit TEEVerifier.AttestationVerified(DOC_HASH, posterior, THRESHOLD, address(this));
        verifier.verifyAndExecute(ASSET_ID, DOC_HASH, sig, posterior, THRESHOLD);
    }

    /*//////////////////////////////////////////////////////////////
                             HELPERS
    //////////////////////////////////////////////////////////////*/

    function _sign(bytes32 docHash, uint256 posterior, uint256 threshold)
        internal
        view
        returns (bytes memory)
    {
        return _signWith(enclavePk, docHash, posterior, threshold);
    }

    function _signWith(uint256 pk, bytes32 docHash, uint256 posterior, uint256 threshold)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 message = keccak256(abi.encodePacked(docHash, posterior, threshold));
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }
}
