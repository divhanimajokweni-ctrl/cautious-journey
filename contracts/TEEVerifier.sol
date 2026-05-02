// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SafetyKernel.sol";

contract TEEVerifier {
    SafetyKernel public kernel;
    bytes32 public expectedPCRHash;

    constructor(address _kernel, bytes32 _expectedHash) {
        kernel = SafetyKernel(_kernel);
        expectedPCRHash = _expectedHash;
    }

    function verify(bytes calldata attestation) external {
        bytes32 hash = keccak256(attestation);
        if (hash != expectedPCRHash) {
            // Force halt: call check with posteriorScaled = 0, threshold = 8000
            kernel.check(0, 8000);
        }
        // If match, do nothing, allow normal check
    }
}