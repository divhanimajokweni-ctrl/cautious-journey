// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BayesianScorer {
    uint256 public constant ALPHA_PRIOR = 1;
    uint256 public constant BETA_PRIOR = 10;

    // Compute posterior in basis points (0-10000)
    function computePosterior(uint256 successes, uint256 failures) public pure returns (uint256) {
        uint256 alphaPost = ALPHA_PRIOR + successes;
        uint256 betaPost = BETA_PRIOR + failures;
        uint256 total = alphaPost + betaPost;
        // posterior = alphaPost / total * 10000
        return (alphaPost * 10000) / total;
    }

    // Check if posterior >= floor (8000 basis points for 0.80)
    function isValid(uint256 successes, uint256 failures, uint256 floor) public pure returns (bool) {
        uint256 posterior = computePosterior(successes, failures);
        return posterior >= floor;
    }
}