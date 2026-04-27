```
# ProofBridge Liner

**Safety Kernel v1.0 — Frozen**

A minimal, trust-minimal circuit-breaker for tokenised real-world assets (RWAs) on EVM-compatible chains. Implements ghost-risk mitigation through hash-verified document anchoring and global transfer gating.

---

## Status

- **Safety Kernel:** Complete and frozen (no further changes)
- **Deployment:** Polygon Amoy testnet (pending wallet funding)
- **Contract Address:** `0x[DEPLOYED_ADDRESS]` (populated after deployment)
- **Oracle Address:** `0x[ORACLE_ADDRESS]` (configured for testing)
- **Tests:** 12/12 passing (Foundry)
- **Audit:** Ghost-risk threat model complete

---

## Problem Statement

Tokenised RWAs introduce "ghost risk": assets that appear liquid but whose underlying documents may be altered or invalidated without on-chain visibility. This creates systemic risk in DeFi lending and trading protocols.

---

## Solution

ProofBridge Liner provides:

- **Document Anchoring:** SHA-256 hashes of legal documents stored on-chain
- **Continuous Verification:** Off-chain oracle fetches fresh document hashes from IPFS
- **Circuit Breaker:** Global transfer pause on hash mismatches
- **Recovery Mechanism:** Owner-controlled circuit reset after resolution

---

## Architecture

### On-Chain Components

- `CircuitBreaker.sol` – Core safety mechanism with oracle gating
- Roles: Oracle (writes proofs), Owner (resets circuit)
- State: Global `circuitOpen` flag gates all ERC-20 transfers

### Off‑Chain Pipeline

| Component | Responsibility |
|-----------|----------------|
| **Fetcher** (`prover/fetcher.js`) | Multi‑gateway IPFS polling and SHA‑256 hashing |
| **Submitter** (`prover/submitter.js`) | Canonicalises actions, signs via SafeKrypte, writes signed attestations |
| **Broadcaster** (`prover/broadcaster.js`) | Reads attestations, sends `updateProof` / `tripCircuit` transactions (dry‑run + live) |
| **Dashboard** | Operations monitoring and phase tracking |

The pipeline runs as:

```

fetcher.js → prover-state.json
→ submitter.js → SafeKrypte → submitter-attestations.json
→ broadcaster.js → broadcast-receipts.json → Polygon Amoy (CircuitBreaker)

```

---

## Threat Model

### Assumed Threats

- Document Tampering: Legal documents modified post‑tokenisation
- Oracle Failure: Single point of failure in hash verification
- Network Partition: IPFS unavailability during critical periods

### Mitigation

- Hash Verification: Cryptographic proof of document integrity
- Multi‑Gateway Fetching: Resilience against IPFS node failures
- Circuit Logic: Fail‑safe transfer blocking on mismatches
- Owner Reset: Human‑in‑the‑loop recovery for false positives

### Explicit Non‑Goals

- Not a full oracle network (Phase 4 future work)
- Not real‑time monitoring (polling‑based, hourly intervals)
- Not multi‑asset support (scoped to MVP demonstration)
- Not mainnet production (testnet deployment only)

---

## Usage

### Prerequisites

```bash
cp .env.example .env
# Edit .env with Polygon Amoy credentials and SafeKrypte endpoint
npm install
```

Deployment (pending wallet funding)

```bash
# Deploy CircuitBreaker to Polygon Amoy
npm run deploy:amoy
# Update .env with deployed address
CIRCUIT_BREAKER_ADDRESS=0xDEPLOYED_ADDRESS
```

Operations

```bash
# Start monitoring dashboard
npm start

# Poll IPFS for document changes
npm run fetch:watch

# Generate signed attestations (off‑chain)
npm run submit:dry

# Broadcast attestations on‑chain (dry‑run first)
npm run broadcast:dry
npm run broadcast
```

Testing

```bash
# Run contract tests (Foundry)
forge test --match-path test/CircuitBreaker.t.sol
# All 12 tests cover access control, hash validation, circuit trip/reset, events
```

---

API Reference

CircuitBreaker Contract

```solidity
function updateProof(bytes32 assetId, bytes32 newHash) external onlyOracle;
function tripCircuit(string calldata reason) external onlyOracle;
function reset() external onlyOwner;
function validate(bytes32 assetId, bytes32 expectedHash) external view returns (bool);
```

Dashboard API

```json
GET /api/status
{
  "circuitBreakerAddress": "0x...",
  "phases": [...],
  "tests": {"total": 12, "passed": 12},
  "assets": [...],
  "proverState": {...}
}
```

---

Security Considerations

· Oracle Trust: Single oracle for MVP; production requires quorum.
· SafeKrypte Integration: Attestations are cryptographically signed by a managed backend; the oracle transaction key is still a hot wallet in staging.
· IPFS Reliability: Multi‑gateway fetching reduces single‑point failures.
· Recovery Process: Owner reset requires manual verification of off‑chain state.
· Gas Costs: <50k gas per operation for economic feasibility.

---

Future Work

· Phase 4: Multi‑node oracle quorum with consensus
· Phase 5: End‑to‑end demonstration with real asset transfers
· Phase 6: Formal security audit and production deployment

---

License

MIT – See LICENSE file for details.

Contributing

This is Safety Kernel v1.0 – Frozen. No contributions accepted until Phase 6 completion.

For questions: [divhanimajokweni@gmail.com]

```

The `README.md` now accurately reflects the off-chain pipeline: the submitter generates SafeKrypte-signed attestations, while the broadcaster handles on-chain transactions. All Operations examples have been updated to use the `broadcast` commands, and the API reference aligns with the actual `CircuitBreaker` function signatures (including `tripCircuit(string reason)`).