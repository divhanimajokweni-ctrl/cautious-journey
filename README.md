# ProofBridge Liner

## Safety Kernel v1.0 — Frozen

A minimal, trust-minimal circuit-breaker for tokenised real-world assets (RWAs) on EVM-compatible chains. Implements ghost-risk mitigation through hash-verified document anchoring and global transfer gating.

## Status

- **Safety Kernel**: Complete and frozen (no further changes)
- **Deployment**: Polygon Amoy testnet
- **Contract Address**: `0x[DEPLOYED_ADDRESS]` (populated after deployment)
- **Oracle Address**: `0x[ORACLE_ADDRESS]` (configured for testing)
- **Tests**: 14/14 passing
- **Audit**: Ghost-risk threat model complete

## Problem Statement

Tokenised RWAs introduce "ghost risk": assets that appear liquid but whose underlying documents may be altered or invalidated without on-chain visibility. This creates systemic risk in DeFi lending and trading protocols.

## Solution

ProofBridge Liner provides:

1. **Document Anchoring**: SHA-256 hashes of legal documents stored on-chain
2. **Continuous Verification**: Off-chain oracle fetches fresh document hashes from IPFS
3. **Circuit Breaker**: Global transfer pause on hash mismatches
4. **Recovery Mechanism**: Owner-controlled circuit reset after resolution

## Architecture

### On-Chain Components

- **CircuitBreaker.sol**: Core safety mechanism with oracle gating
- **Roles**: Oracle (writes proofs), Owner (resets circuit)
- **State**: Global `tripped` flag gates all ERC-20 transfers

### Off-Chain Components

- **Fetcher**: Polls IPFS gateways for document hashes
- **Submitter**: Updates on-chain proofs via oracle role
- **Dashboard**: Operations monitoring and phase tracking

## Threat Model

### Assumed Threats

- **Document Tampering**: Legal documents modified post-tokenisation
- **Oracle Failure**: Single point of failure in hash verification
- **Network Partition**: IPFS unavailability during critical periods

### Mitigation

- **Hash Verification**: Cryptographic proof of document integrity
- **Multi-Gateway Fetching**: Resilience against IPFS node failures
- **Global Circuit Logic**: Fail-safe transfer blocking on mismatches
- **Owner Reset**: Human-in-the-loop recovery for false positives

### Explicit Non-Goals

- Not a full oracle network (Phase 4 future work)
- Not real-time monitoring (polling-based, 5-minute intervals)
- Not multi-asset support (scoped to MVP demonstration)
- Not mainnet production (testnet deployment only)

## Usage

### Prerequisites

```bash
# Environment setup
cp .env.example .env
# Edit .env with Polygon Amoy credentials

# Dependencies
npm install
```

### Deployment

```bash
# Deploy CircuitBreaker to Polygon Amoy
npm run deploy:amoy

# Update .env with deployed address
CIRCUIT_BREAKER_ADDRESS=0xDEPLOYED_ADDRESS
```

### Operations

```bash
# Start monitoring dashboard
npm start

# Run fetcher (polls IPFS for document changes)
npm run fetch:watch

# Submit proof updates (dry-run first)
npm run submit:dry
npm run submit
```

## Testing

```bash
# Run contract tests
npm run test:contracts

# All 14 tests cover:
# - Access control (oracle/owner roles)
# - Hash validation logic
# - Circuit trip/reset mechanics
# - Event emission
```

## API Reference

### CircuitBreaker Contract

```solidity
function updateProof(bytes32 assetId, bytes32 newHash) external onlyOracle
function tripCircuit() external onlyOracle
function resetCircuit() external onlyOwner
function validateTransfer(address from, address to, uint256 amount) external view returns (bool)
```

### Dashboard API

```json
GET /api/status
{
  "circuitBreakerAddress": "0x...",
  "phases": [...],
  "tests": {"total": 14, "passed": 14},
  "assets": [...],
  "proverState": {...}
}
```

## Security Considerations

- **Oracle Trust**: Single oracle for MVP; production requires quorum
- **IPFS Reliability**: Gateway failures mitigated by multi-source fetching
- **Recovery Process**: Owner reset requires manual verification
- **Gas Costs**: <50k per operation for economic feasibility

## Future Work

- **Phase 4**: Multi-node oracle quorum with consensus
- **Phase 5**: End-to-end demonstration with real asset transfers
- **Phase 6**: Formal security audit and production deployment

## License

MIT - See LICENSE file for details.

## Contributing

This is Safety Kernel v1.0 — Frozen. No contributions accepted until Phase 6 completion.

For questions: [divhanimajokweni@gmail.com]

---

*This implementation provides a reference-grade demonstration of ghost-risk mitigation for tokenised RWAs. Not intended for production use without Phase 4 quorum implementation.*