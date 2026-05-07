// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BayesianScorer.sol";

contract SafetyKernel {
    enum State { OPEN, HALTED }
    enum Actor { UNAUTHORIZED, AUTHORIZED }

    State public state = State.OPEN;
    address public authorizedActor;
    uint256 public constant FLOOR_80 = 80; // 80% in basis points? Wait, 0.80 as 80/100

    BayesianScorer public scorer;

    event StateChanged(State newState);
    event ResetInitiated(address actor);

    constructor(address _authorizedActor, address _scorer) {
        authorizedActor = _authorizedActor;
        scorer = BayesianScorer(_scorer);
    }

    modifier onlyAuthorized() {
        require(msg.sender == authorizedActor, "Unauthorized");
        _;
    }

    function check(uint256 posteriorScaled, uint256 threshold) external {
        // posteriorScaled is in basis points (e.g., 8000 for 80%)
        if (posteriorScaled < threshold) {
            state = State.HALTED;
            emit StateChanged(State.HALTED);
        }
        // else remains OPEN
    }

    function reset() external onlyAuthorized {
        require(state == State.HALTED, "Not halted");
        state = State.OPEN;
        emit StateChanged(State.OPEN);
        emit ResetInitiated(msg.sender);
    }

    function assertOpen() external view {
        require(state == State.OPEN, "Kernel is halted");
    }
}