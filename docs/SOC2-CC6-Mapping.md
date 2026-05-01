# SOC 2 Type II — CC6 Logical Access Control Mapping
## ProofBridge Liner · Institution-Grade Circuit Breaker

**Document version:** 1.0  
**Date:** 2026-05-01  
**Scope:** `contracts/AssetRegistry.sol`, `contracts/TEEVerifier.sol`,
`contracts/CircuitBreaker.sol`, `proofs/SafetyKernel.v`

---

## CC6 Control Objective

> The entity implements logical access security software, infrastructure,
> and architectures over protected information assets to protect them from
> security events to meet the entity's objectives.

---

## CC6.1 — Logical Access Security Measures

| Control Criterion | ProofBridge Implementation | Evidence Artifact |
|---|---|---|
| Access to protected information is restricted to authorized users. | `AssetRegistry.onlyOwner` modifier gates all administrative writes. Non-owners receive `"AR: not owner"` revert. | `contracts/AssetRegistry.sol` L48–51 |
| User identification and authentication is required prior to granting access. | TEEVerifier enforces EIP-191 ECDSA signature from the registered enclave before any kernel state change. Unsigned or mis-signed calls revert with `"TEE: INVALID_ATTESTATION"`. | `contracts/TEEVerifier.sol` L68–76 |
| Access is granted consistent with job responsibilities. | Three distinct roles: `owner` (admin), `authorizedResetter` (per-asset reset only), enclave (check writes only). No role can exceed its surface. | `contracts/AssetRegistry.sol` L130–137 |
| Access to protected assets is removed when no longer required. | `transferOwnership()` atomically revokes the prior owner. Per-asset `authorizedResetter` is set to `address(0)` to revoke. | `contracts/AssetRegistry.sol` L193–198 |

---

## CC6.2 — Prior to Issuing Credentials

| Control Criterion | ProofBridge Implementation | Evidence Artifact |
|---|---|---|
| Credentials are issued only after identity is established. | Enclave address is set once at deploy-time via immutable `enclavePublicKey`. Cannot be changed post-deployment, preventing credential substitution. | `contracts/TEEVerifier.sol` L40–41 |
| Credentials are not transmitted in clear text. | All authentication is via on-chain ECDSA signature verification. Private keys never appear in contract storage or calldata. | `contracts/TEEVerifier.sol` L86–106 |

---

## CC6.3 — Role-Based Access

| Role | Capabilities | Contract Enforcement |
|---|---|---|
| `owner` | Register assets, set thresholds, reset any kernel, transfer ownership | `onlyOwner` modifier on `registerAsset`, `setThreshold`, `transferOwnership`, `reset` |
| `authorizedResetter` | Reset one specific asset's kernel only | `reset()` checks `msg.sender == k.authorizedResetter` |
| `enclave` (TEEVerifier) | Advance kernel state via `check()` only | TEEVerifier is the only caller; signature checked before `kernel.check()` |
| Any address | Read `isOpen()`, call `assertOpen()` | View functions — no state modification possible |

---

## CC6.6 — Boundary Protection

| Control Criterion | ProofBridge Implementation | Evidence Artifact |
|---|---|---|
| Logical boundaries protect information assets. | Each asset has a fully isolated `KernelState` struct. A halt in one asset cannot affect another (`mapping(bytes32 => KernelState)`). | `contracts/AssetRegistry.sol` L34, L90–102 |
| Boundary protection mechanisms are in place. | The `assertOpen(assetId)` hook reverts token transfers when the kernel is HALTED, enforcing the boundary at the EVM level. | `contracts/AssetRegistry.sol` L155–161 |
| Boundary protections are monitored. | `KernelTripped`, `KernelReset`, `AssetRegistered`, `AttestationVerified` events provide immutable audit trail on-chain. | All contracts, Events sections |

---

## CC6.7 — Transmission Integrity

| Control Criterion | ProofBridge Implementation | Evidence Artifact |
|---|---|---|
| Data is protected during transmission. | All oracle/TEE data is authenticated via ECDSA before it can modify state. Replayed or tampered payloads are rejected. | `contracts/TEEVerifier.sol` L68–76 |
| Cryptographic mechanisms protect transmission integrity. | `keccak256(abi.encodePacked(docHash, posterior, threshold))` binds all three fields together. Changing any single field invalidates the signature. | `contracts/TEEVerifier.sol` L63–65 |

---

## CC6.8 — Malicious Software Prevention

| Control Criterion | ProofBridge Implementation | Evidence Artifact |
|---|---|---|
| Malicious software is prevented from being introduced. | Smart contracts are immutable after deployment. No `delegatecall`, no upgradeable proxy, no `selfdestruct` in CircuitBreaker or AssetRegistry. | `contracts/CircuitBreaker.sol`, `contracts/AssetRegistry.sol` |
| Formal verification confirms absence of unauthorized state transitions. | Coq proof (`proofs/SafetyKernel.v`) provides machine-checked guarantee that UNAUTH actors cannot reset HALTED state. TLA+ model (`proofs/SafetyKernel.tla`) confirms no deadlocks. | `proofs/SafetyKernel.v`, `proofs/SafetyKernel.tla` |

---

## Gas Analysis (DoS Prevention)

The following confirms `O(1)` execution with no unbounded loops:

| Function | Gas bound | Notes |
|---|---|---|
| `check(assetId, posterior)` | ~5,000 gas | Single mapping read + conditional SSTORE |
| `assertOpen(assetId)` | ~2,200 gas | Single mapping read + require |
| `reset(assetId)` | ~7,500 gas | Two SSTOREs + event emit |
| `registerAsset(...)` | ~65,000 gas | Struct SSTORE (first-time cold write) |

All hot-path functions (`check`, `assertOpen`) are O(1) and bounded,
preventing Denial-of-Service via gas exhaustion.

---

## Summary Matrix

| SOC 2 CC | Status | Key Control |
|---|---|---|
| CC6.1 | ✅ Implemented | `onlyOwner` + EIP-191 TEE attestation |
| CC6.2 | ✅ Implemented | Immutable enclave key, ECDSA-only auth |
| CC6.3 | ✅ Implemented | Three-role access model |
| CC6.6 | ✅ Implemented | Per-asset kernel isolation |
| CC6.7 | ✅ Implemented | ECDSA-bound payload integrity |
| CC6.8 | ✅ Implemented | Immutable contracts + Coq + TLA+ proofs |

---

*This document is intended as evidence for SOC 2 Type II audit preparation.
Final audit opinion is the sole responsibility of the appointed CPA firm.*
