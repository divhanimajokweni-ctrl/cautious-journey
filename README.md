# ProofBridge Liner

## Safety Kernel v1.0 — Frozen

A minimal, trust-minimal circuit breaker for tokenised real‑world assets (RWAs) on EVM‑compatible chains.  
Implements ghost‑risk mitigation through hash‑verified document anchoring and enforced transfer gating.

> **Canonical Framing:**  
> ProofBridge Liner does not prove legal truth on‑chain; it prevents markets from trading when legal truth is uncertain.

---

## Status

- **Safety Kernel:** Complete and frozen (no further changes permitted)
- **Deployment Target:** Polygon Amoy testnet
- **Contract Address:** `0x[DEPLOYED_ADDRESS]` *(populated post‑deployment)*
- **Oracle Address:** `0x[ORACLE_ADDRESS]` *(test configuration)*
- **Tests:** 14/14 passing (Foundry)
- **Audit:** Ghost‑risk threat model complete

---

## Problem Statement

Tokenised RWAs introduce **ghost risk**: assets that appear liquid on‑chain while their underlying legal documents may be altered, encumbered, or invalidated off‑chain without immediate visibility.

This mismatch creates systemic risk for:
- Secondary markets
- DeFi lending protocols
- Issuers and investors exposed to illegal or unenforceable trades

---

## Solution Overview

ProofBridge Liner provides:

1. **Document Anchoring** — SHA‑256 hashes of authoritative legal documents stored on‑chain  
2. **Continuous Verification** — Off‑chain prover re‑fetches and re‑hashes documents from IPFS  
3. **Circuit Breaker Enforcement** — Global transfer halt on hash divergence  
4. **Human Recovery Loop** — Issuer‑controlled reset after resolution

The system is intentionally minimal and fail‑closed.

---

## Architecture

### On‑Chain Components

- **CircuitBreaker.sol**
  - Enforces global transfer gating
  - Oracle‑restricted proof updates
  - Issuer‑restricted reset authority
- **Roles**
  - **Oracle:** May update proofs and trip the circuit
  - **Owner (Issuer):** Sole authority to reset the circuit
- **State**
  - `circuitOpen` flag gates all hooked token transfers
  - `latestProof[assetId] → deedHash`

### Off‑Chain Components (Reference Implementation)

- **Fetcher:** Multi‑gateway IPFS polling and SHA‑256 hashing  
- **Submitter:** Oracle‑signed on‑chain transactions (dry‑run + live)  
- **Dashboard:** Operational visibility and phase tracking

---

## Safety Invariants (Frozen)

The following invariants define Safety Kernel v1.0:

- Transfers must fail when legal truth is uncertain  
- Oracle may halt trading but can never resume it  
- Issuer retains exclusive recovery authority  
- Enforcement must be deterministic and gas‑bounded  

No changes to these invariants are permitted without a new kernel version.

---

## Threat Model

### Assumed Threats

- **Document Tampering:** Legal documents modified post‑tokenisation  
- **Oracle Failure:** Single‑oracle trust at MVP stage  
- **Network Partition:** IPFS gateway outages

### Mitigations

- Cryptographic hash verification  
- Multi‑gateway IPFS fetching  
- Fail‑closed global circuit logic  
- Manual issuer reset for false positives

### Explicit Non‑Goals

- Not a full oracle network (Phase 4 future work)  
- Not real‑time monitoring (polling‑based)  
- **Multi‑asset capable, but demonstrated with a single asset in the MVP**  
- Not mainnet production software

---

## Usage

### Prerequisites

```bash
cp .env.example .env
npm install
```

### Deployment (Testnet)

```bash
npm run deploy:amoy
# Populate CIRCUIT_BREAKER_ADDRESS after deployment
```

### Operations

```bash
npm start              # dashboard
npm run fetch:watch    # IPFS polling
npm run submit:dry
npm run submit
```

***

## Testing

```bash
npm run test:contracts
```

Covers:

*   Access control (oracle / owner)
*   Proof updates
*   Circuit trip & reset
*   Event emission

***

## Contract Interface (Safety Kernel v1.0)

```solidity
function updateProof(bytes32 assetId, bytes32 deedHash) external onlyOracle;
function tripCircuit(string calldata reason) external onlyOracle;
function validate(bytes32 assetId, bytes32 expectedHash)
    external view returns (bool);
function reset() external onlyOwner;
```

***

## Security Considerations

*   Single‑oracle trust model (MVP only)
*   No automated recovery
*   No custody or adjudication logic
*   Gas‑bounded enforcement (<50k gas per operation)

***

## Future Work

*   Phase 4: Oracle quorum / HSM custody
*   Phase 5: Live asset demo
*   Phase 6: Formal external audit & production hardening

***

## License

MIT

## Contributing

Safety Kernel v1.0 is frozen.  
No contributions accepted until Phase 6 completion.

***

*This repository provides a reference‑grade demonstration of ghost‑risk mitigation for tokenised RWAs.  
Not intended for production use without additional trust hardening.*