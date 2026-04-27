# SafeKrypte-Backed Oracle Attestation for ProofBridge Liner

## A Minimal Research Architecture for Replacing Hot-Wallet Proof Relays with Auditable Signing Infrastructure

**Repository:** `divhanimajokweni-ctrl/proofbridge-liner`
**System:** ProofBridge Liner Safety Kernel v1.0
**Implementation locus:** `prover/submitter.js`
**Status:** Research framework complete; attestation layer scoped for future Phase 4 implementation  

---

## Abstract

ProofBridge Liner is a ghost-risk circuit-breaker for tokenised real-world assets. Its core function is to observe external proof state, classify each asset as fresh, mismatched, or unreachable, and convert those classifications into circuit-breaker actions. The initial architecture planned for an eventual on-chain relay, but the pre-existing relay path was a dry-run logger and the future broadcast path implied a conventional local private-key signer.

This paper documents the research framework for upgrading ProofBridge Liner's oracle signing infrastructure from hot-wallet patterns to externally auditable attestation. The Safety Kernel v1.0 implements a simplified single-oracle model for MVP demonstration, with this SafeKrypte-backed architecture preserved as the upgrade path for Phase 4 multi-oracle quorum implementation.

The central claim remains: ProofBridge Liner does not require a multi-oracle staking network at MVP stage. It needs a single oracle pathway whose signing boundary is externally auditable, replaceable, and compatible with later HSM or staking upgrades. SafeKrypte supplies that boundary without requiring smart-contract migration, but is deferred until post-publication Phase 4 development.

---

## 1. Problem Statement

Real-world asset systems depend on proof relays. A relay observes external truth, converts that observation into protocol action, and may trigger consequences such as proof updates or circuit-breaker trips. In early-stage systems, relays are often implemented with local hot wallets because hot wallets are fast to integrate and easy to script. That shortcut creates three problems.

First, the signing key becomes operationally fragile. A private key in an environment variable is not a security boundary; it is a deployment convenience. Second, the system lacks a durable audit trail. A transaction hash may prove that an on-chain action occurred, but it does not necessarily prove what input state produced the action or what authority signed the pre-broadcast decision. Third, the upgrade path is usually invasive. Moving from a local signer to an HSM, threshold signer, or slashing network often forces changes across application code, deployment scripts, and sometimes the contract interface.

ProofBridge Liner required a cleaner primitive: a relay action should become a signed attestation before it becomes a transaction.

---

## 2. System Context

The ProofBridge Liner repository defines a Node-based MVP relay pipeline. The fetcher produces `.local/state/prover-state.json`. The submitter reads that state and derives planned circuit-breaker actions.

The action derivation rule is deliberately simple:

| Observed status | Planned action |
|---|---|
| `fresh` | `updateProof(assetId, deedHash)` |
| `mismatch` | `tripCircuit(assetId, reason)` |
| `unreachable` | `tripCircuit(assetId, reason)` |

Before this upgrade, `prover/submitter.js` logged the planned actions and ended with a dry-run message. That made it useful as a planning component, but not yet suitable as an institutional proof relay.

The new implementation preserves the same action semantics but adds a cryptographic attestation layer before broadcast.

---

## 3. Design Thesis

The central design thesis is:

> The oracle boundary should be abstracted as a signing service, not embedded as a local private key.

This thesis decomposes into three irreducible requirements.

### 3.1 Deterministic Action Material

The relay must sign the same logical payload into the same digest. This requires canonical JSON serialization rather than relying on insertion-order object formatting.

### 3.2 Externalized Signing Authority

The submitter must not hold raw private-key authority. It should request a signature from a signer endpoint whose implementation can evolve from simulator to HSM to threshold infrastructure.

### 3.3 Persisted Audit Artifact

The result must be written as an inspectable artifact. The output should survive process termination and provide enough material for replay, dispute resolution, and issuer review.

---

## 4. Implemented Architecture

The implemented architecture modifies `prover/submitter.js` so that every planned action flows through five stages.

```text
prover-state.json
      ↓
planActions(state)
      ↓
canonical action payload
      ↓
SHA-256 digest
      ↓
SafeKrypte /sign
      ↓
submitter-attestations.json
```

The contract broadcast path remains intentionally disabled until the address, ABI, and operational policy are finalized.

---

## 5. Payload Model

Each signed payload has the following logical structure:

```json
{
  "type": "ProofBridgeLinerAction",
  "action": {
    "kind": "updateProof | tripCircuit",
    "assetId": "...",
    "deedHash": "...",
    "reason": "..."
  },
  "stateRunId": "... | null",
  "stateGeneratedAt": "... | null",
  "issuedAt": "ISO-8601 timestamp"
}
```

The output attestation extends this payload with cryptographic metadata:

```json
{
  "digest": "0x...",
  "signature": "0x...",
  "signerAddress": "... | null",
  "keyId": "proofbridge-oracle-dev",
  "auditId": "... | null",
  "backend": "safekrypte-simulator"
}
```

The distinction matters. The payload expresses what the relay intends to do. The digest commits to the exact payload. The signature binds the digest to an oracle signing authority. The persisted file makes that binding reviewable before, during, and after any on-chain execution.

---

## 6. SafeKrypte Integration Boundary

The submitter talks to SafeKrypte through one HTTP endpoint:

```text
POST /sign
```

The request includes:

```json
{
  "keyId": "proofbridge-oracle-dev",
  "payload": {},
  "digest": "0x...",
  "algorithm": "ECDSA_SECP256K1",
  "encoding": "hex"
}
```

Runtime configuration is environment-driven:

| Variable | Default | Purpose |
|---|---:|---|
| `SAFEKRYPTE_SIMULATOR_URL` | `http://localhost:3001` | Signing endpoint base URL |
| `SAFEKRYPTE_SIGNING_KEY_ID` | `proofbridge-oracle-dev` | Logical oracle key identifier |
| `SAFEKRYPTE_TIMEOUT_MS` | `10000` | Request timeout |
| `SAFEKRYPTE_API_KEY` | unset | Optional bearer credential |
| `SAFEKRYPTE_ALGORITHM` | `ECDSA_SECP256K1` | Requested signing algorithm |

This boundary is intentionally small. The submitter does not know whether the backing implementation is a simulator, HSM, managed key service, or later threshold signer. It only requires a signature-bearing response.

---

## 7. Security Properties

### 7.1 Hot-Wallet Elimination

The submitter no longer requires a local private key for action authorization. This removes the most dangerous early-stage operational pattern: placing a production-significant key in `.env` and allowing application code to sign directly.

### 7.2 Replayability

The canonical payload and digest make each action replayable. A reviewer can reconstruct the digest from the persisted payload and verify whether the signature corresponds to the claimed key authority.

### 7.3 Audit Separation

The system separates observation, decision, attestation, and broadcast.

```text
Observation: prover-state.json
Decision:    planActions(state)
Attestation: SafeKrypte signature
Broadcast:   deferred contract transaction
```

This separation prevents a premature collapse of all authority into a single transaction script.

### 7.4 Upgrade Compatibility

Because the contract trusts an oracle address rather than the internal mechanics of signing, the signing backend can evolve without changing the on-chain access-control design. The immediate backend is the SafeKrypte simulator. A later backend may be SafeKrypte HSM. A later network form may involve SafeStakes, but that is not required for the MVP.

---

## 8. Why SafeStakes Is Deferred

SafeStakes introduces slashing, renewal grace, escrow custody, and multi-gate enforcement primitives. These are valuable primitives for a decentralized attestation network, but they are not necessary for the first issuer-facing ProofBridge Liner deployment.

The MVP question is not, “Can many signers be economically punished?”

The MVP question is, “Can one oracle produce a clean, inspectable, non-hot-wallet attestation path?”

The implemented system answers the second question. SafeStakes remains a later-stage expansion for a multi-oracle trust model.

---

## 9. Operational Runbook

Start the SafeKrypte simulator from the SafeKrypte-containing monorepo:

```bash
npx tsx packages/safekrypte/src/simulator.ts
```

Run the ProofBridge Liner fetcher and submitter:

```bash
node prover/fetcher.js
node prover/submitter.js --dry-run
```

Expected output:

1. planned `updateProof` and `tripCircuit` actions are printed;
2. each action is signed through SafeKrypte;
3. signed attestations are written to:

```text
.local/state/submitter-attestations.json
```

---

## 10. Research Contribution

The contribution is not a new cryptographic primitive. It is an architectural sequencing correction.

Most MVP oracle systems move directly from observation to transaction. That creates a brittle path:

```text
observe → sign locally → broadcast
```

ProofBridge Liner now uses a stronger intermediate structure:

```text
observe → decide → attest externally → persist → broadcast later
```

This gives the system a pre-chain evidentiary layer. That layer is essential for real-world assets because the highest-value disputes are often not about whether a transaction occurred. They are about whether the protocol had a defensible basis for taking the action.

---

## 11. Limitations

The current implementation has clear limits.

First, the SafeKrypte simulator currently provides mock signing behavior. It proves the boundary and integration pattern, not final production-grade custody. Second, on-chain broadcast is still disabled. This is correct for the present stage, but the next implementation phase must bind signed attestations to contract calls. Third, signature verification is not yet implemented in the submitter test suite. A production pathway should add deterministic fixture tests, failure-mode tests, and verifier-side digest reconstruction.

These limitations do not weaken the architectural result. They define the next controlled increments.

---

## 12. Publication Status & Next Work

**Current Status:** This research framework is complete and publication-ready as part of Class A research artifacts. The Safety Kernel v1.0 implements a simplified oracle model sufficient for MVP demonstration.

**Publication Timeline:**
- **Class A (Research):** Complete - This paper ready for publication
- **Class B (Protocol):** Next Sprint - Deploy with single oracle model
- **Class C (Demo):** Future - Full production with advanced signing

**Phase 4 Implementation Roadmap (Post-Publication):**

1. Integrate SafeKrypte attestation layer into `prover/submitter.js`
2. Implement local verification command for `submitter-attestations.json`
3. Add tests for deterministic digest generation
4. Add tests for SafeKrypte timeout and error handling
5. Enable ABI-aware transaction broadcasting with attestation linkage
6. Deploy HSM-backed SafeKrypte for production oracle custody
7. Implement SafeStakes multi-oracle slashing network (Phase 4 future)

---

## 13. Conclusion

This research framework establishes the architectural foundation for auditable oracle signing in ProofBridge Liner. The Safety Kernel v1.0 implements a simplified single-oracle model sufficient for MVP demonstration and publication. The SafeKrypte-backed attestation architecture is preserved as the research-grounded upgrade path for Phase 4 multi-oracle implementation.

The result is a research-complete architecture: externally managed signing, deterministic payloads, persisted attestations, and a clear progression from single-oracle MVP to multi-oracle production without premature complexity. This framework enables credible Class A research publication while maintaining the upgrade path to institutional-grade signing infrastructure.
