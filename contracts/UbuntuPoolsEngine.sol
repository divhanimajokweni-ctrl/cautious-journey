// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title  UbuntuPoolsEngine
 * @notice Ubuntu stokvel pool management with multi-sig committee approval.
 * @dev    Replaces MVP CircuitBreaker+AssetRegistry combo for pool operations.
 *
 *   Key roles:
 *     OWNER   — deployer; may set thresholds, add/remove committee members
 *     KEEPER  — accepted committee member; votes on proposals
 *
 *   Flow:
 *     proposePool(params) → committee votes via castVote
 *     → if votesFor + votesAgainst ≥ quorum, settleProposal() → APPROVED/REJECTED
 *     → backend oracle calls settleProposal() for final state change
 */
contract UbuntuPoolsEngine {
    /*//////////////////////////////////////////////////////////////
                                  TYPES
    //////////////////////////////////////////////////////////////*/

    enum ProposalStatus { PENDING, APPROVED, REJECTED, EXECUTED, CANCELLED }

    struct PoolProposal {
        bytes32        id;
        address        proposer;
        string         entityId;
        address        beneficiary;
        uint256        amount;
        uint8          bankCode;
        string         accountNumber;
        uint256        createdAt;
        uint256        quorum;
        uint256        votesFor;
        uint256        votesAgainst;
        mapping(address => bool) hasVoted;
        ProposalStatus status;
    }

    struct PoolMember {
        address wallet;
        uint256  joinedAt;
        uint256  totalVotes;
        bool     active;
    }

    /*//////////////////////////////////////////////////////////////
                                  STATE
    //////////////////////////////////////////////////////////////*/

    address public immutable owner;
    uint256 public committeeQuorum;
    bytes32[] public proposalIds;
    mapping(bytes32 => PoolProposal) public proposals;
    mapping(address => PoolMember)   public members;
    mapping(address => bool)         public isCommitteeMember;
    uint256 public memberCount;
    uint256 public totalProposals;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event PoolCreated(bytes32 indexed proposalId, address indexed proposer, uint256 amount, string entityId);
    event Voted(bytes32 indexed proposalId, address indexed voter, bool approve);
    event ProposalStateChange(bytes32 indexed proposalId, ProposalStatus oldStatus, ProposalStatus newStatus);
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "UPE: not owner");
        _;
    }

    modifier onlyKeeper() {
        require(isCommitteeMember[msg.sender], "UPE: not committee");
        _;
    }

    modifier proposalExists(bytes32 pid) {
        require(proposals[pid].id != bytes32(0), "UPE: proposal not found");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                INIT
    //////////////////////////////////////////////////////////////*/

    constructor(address[] memory _committee, uint256 _quorum) {
        owner            = msg.sender;
        committeeQuorum  = _quorum;
        require(_committee.length >= _quorum, "UPE: too few committee");
        for (uint256 i; i < _committee.length; i++) {
            _addCommitteeMember(_committee[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              COMMITTEE MGMT
    //////////////////////////////////////////////////////////////*/

    function addCommitteeMember(address member) external onlyOwner {
        _addCommitteeMember(member);
        emit MemberAdded(member);
    }

    function removeCommitteeMember(address member) external onlyOwner {
        require(isCommitteeMember[member], "UPE: not a member");
        require(memberCount > committeeQuorum, "UPE: would break quorum");
        isCommitteeMember[member] = false;
        members[member].active = false;
        memberCount--;
        emit MemberRemoved(member);
    }

    function _addCommitteeMember(address member) internal {
        require(member != address(0), "UPE: zero addr");
        require(!isCommitteeMember[member], "UPE: already committee");
        isCommitteeMember[member] = true;
        members[member] = PoolMember({ wallet: member, joinedAt: block.timestamp, totalVotes: 0, active: true });
        memberCount++;
    }

    /*//////////////////////////////////////////////////////////////
                              POOL LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function proposePool(
        string  memory entityId,
        address beneficiary,
        uint256 amount,
        uint8   bankCode,
        string  memory accountNumber,
        uint256 quorumOverride
    ) external onlyKeeper returns (bytes32) {
        require(bytes(entityId).length > 0,   "UPE: empty entityId");
        require(amount > 0,                   "UPE: zero amount");
        require(beneficiary != address(0),    "UPE: zero beneficiary");

        bytes32 pid = keccak256(abi.encodePacked(entityId, msg.sender, block.timestamp, address(this)));
        uint256 q   = quorumOverride > 0 && quorumOverride >= committeeQuorum
            ? quorumOverride
            : committeeQuorum;

        proposals[pid] = PoolProposal({
            id:            pid,
            proposer:      msg.sender,
            entityId:      entityId,
            beneficiary:   beneficiary,
            amount:        amount,
            bankCode:      bankCode,
            accountNumber: accountNumber,
            createdAt:     block.timestamp,
            quorum:        q,
            votesFor:      0,
            votesAgainst:  0,
            status:        ProposalStatus.PENDING
        });
        proposalIds.push(pid);
        totalProposals++;
        emit PoolCreated(pid, msg.sender, amount, entityId);
        return pid;
    }

    function castVote(bytes32 pid, bool vote) external onlyKeeper proposalExists(pid) {
        PoolProposal storage p = proposals[pid];
        require(p.status == ProposalStatus.PENDING,  "UPE: not pending");
        require(!p.hasVoted[msg.sender],             "UPE: already voted");

        p.hasVoted[msg.sender] = true;
        if (vote) {
            p.votesFor++;
            members[msg.sender].totalVotes++;
        } else {
            p.votesAgainst++;
        }
        emit Voted(pid, msg.sender, vote);
    }

    /**
     * @notice Finalise a pool proposal when quorum is reached.
     * @dev    Called off-chain (oracle) after TEEVerifier produces a decision.
     * @param  pid         Proposal ID.
     * @param  approved    true  → APPROVED
     *                     false → REJECTED
     */
    function settleProposal(bytes32 pid, bool approved)
        external
        onlyOwner
        proposalExists(pid)
    {
        PoolProposal storage p = proposals[pid];
        require(p.status == ProposalStatus.PENDING, "UPE: not pending");
        require(
            p.votesFor + p.votesAgainst >= p.quorum,
            "UPE: quorum not met"
        );

        ProposalStatus old = p.status;
        p.status = approved ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;
        emit ProposalStateChange(pid, old, p.status);
    }

    /**
     * @notice Cancel a pending pool proposal.
     */
    function cancelProposal(bytes32 pid) external proposalExists(pid) {
        PoolProposal storage p = proposals[pid];
        require(p.status == ProposalStatus.PENDING, "UPE: not pending");
        require(msg.sender == p.proposer || msg.sender == owner, "UPE: unauthorised");

        ProposalStatus old = p.status;
        p.status = ProposalStatus.CANCELLED;
        emit ProposalStateChange(pid, old, ProposalStatus.CANCELLED);
    }

    /*//////////////////////////////////////////////////////////////
                                 READS
    //////////////////////////////////////////////////////////////*/

    function getProposal(bytes32 pid) external view returns (PoolProposal memory) {
        return proposals[pid];
    }

    function getMember(address member) external view returns (PoolMember memory) {
        return members[member];
    }

    function getProposalsByStatus(ProposalStatus status) external view returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](proposalIds.length);
        uint256 count;
        for (uint256 i; i < proposalIds.length; i++) {
            if (proposals[proposalIds[i]].status == status) {
                result[count++] = proposalIds[i];
            }
        }
        assembly { result.length := count }
        return result;
    }
}
