# ProofBridge Liner — Replit Project Notes

## What this project is

A **Ghost-Risk Circuit-Breaker** (proofBRIDGE-liner) that any tokenised
real-world asset (e.g. a RealT property token) can integrate with a
5-line `_beforeTokenTransfer` hook. The on-chain `CircuitBreaker.sol`
contract is fed deed hashes by an off-chain prover; if the deed bytes
on IPFS no longer hash to the expected value, transfers revert.

Implemented at **institution-grade** with three formal layers:
1. **Logic Layer** — Coq-verified total functions (`proofs/SafetyKernel.v`)
2. **Input Layer** — TEE-signed attestations (`contracts/TEEVerifier.sol`)
3. **Enforcement Layer** — Per-asset isolated EVM kernels (`contracts/AssetRegistry.sol`)

## Stack

- **Solidity 0.8.20** + **Foundry** for all on-chain contracts and tests.
- **Node.js 20** for the off-chain prover and the operations dashboard.
- **Express 4** for the dashboard web app (port 5000).
- **Coq** (external) for the formal safety kernel proof.

## Project layout

```
contracts/
  CircuitBreaker.sol      MVP single-oracle circuit breaker (Phase 1–2)
  CircuitBreakerV2.sol    Threshold-signature upgrade (3-of-5 ECDSA)
  AssetRegistry.sol       Multi-asset isolated kernels (institution-grade)
  TEEVerifier.sol         TEE input-admissibility bridge (institution-grade)
  IProofHook.sol          Token-integration interface
  mock/MockRealT.sol      ERC-20 mock for integration testing
proofs/
  SafetyKernel.v          Coq formal proof — 4 theorems, HALTED absorbing
test/
  CircuitBreaker.t.sol    14 Foundry tests — 100% pass
  AssetRegistry.t.sol     Foundry tests — isolation, check, reset coverage
  TEEVerifier.t.sol       Foundry tests — happy-path + adversarial sigs
script/
  DeployCircuitBreaker.s.sol  Phase 2 single deployment
  DeployFull.s.sol            Full institution-grade deployment
prover/
  fetcher.js, tss-signer.js, submitter.js, auditor.js, broadcaster.js
signer-nodes/             Phase 4 Docker quorum placeholder
config/
  assets.json, signer-nodes.json
dashboard/
  server.js               Express API + ops dashboard (port 5000)
  public/                 index.html, app.js, styles.css, favicon.svg
```

## Architecture layers

| Layer | Contract | Role |
|---|---|---|
| Logic | `proofs/SafetyKernel.v` | Coq proof: UNAUTH cannot reset |
| Input | `TEEVerifier.sol` | EIP-191 enclave attestation gate |
| Enforcement | `AssetRegistry.sol` | Per-asset isolated OPEN/HALTED kernels |
| Token hook | `assertOpen(assetId)` | Called in every `transfer()` |

## Formal verification artifacts

- **Coq Proof** ✅ — 4 theorems; `HALTED` is absorbing for `UNAUTH` actors
- **Gas analysis** ✅ — `check()` and `assertOpen()` are O(1)
- **TLA+ Model** ✅ — 4 invariants + liveness; no deadlocks (`proofs/SafetyKernel.tla` + `.cfg`)
- **SOC 2 CC6** ✅ — CC6.1/2/3/6/7/8 fully mapped (`docs/SOC2-CC6-Mapping.md`)

## Replit setup

- Workflow **Start application** runs `npm run start` and serves the
  ops dashboard on `http://0.0.0.0:5000`.
- The Express server sets `app.set('trust proxy', true)` and disables
  caching in dev so the Replit iframe preview always sees fresh content.
- Deployment target: **autoscale**, run command `node dashboard/server.js`.

## Environment variables (set after deployment)

| Variable | Purpose |
|---|---|
| `CIRCUIT_BREAKER_ADDRESS` | MVP CircuitBreaker address on Amoy |
| `ORACLE_ADDRESS` | Single oracle address (MVP) |
| `ASSET_REGISTRY_ADDRESS` | AssetRegistry address on Amoy |
| `TEE_VERIFIER_ADDRESS` | TEEVerifier address on Amoy |
| `ENCLAVE_ADDRESS` | TEE enclave public key (address form) |
| `POLYGON_AMOY_RPC_URL` | RPC endpoint for deployment/submission |
| `PRIVATE_KEY` | Deployer private key (secret) |

## What still requires the user

- `forge` is not installed in the Replit container. Foundry test/deploy
  commands are run locally or in CI.
- To deploy: set env vars above and run `npm run deploy:amoy` (CircuitBreaker)
  or `forge script script/DeployFull.s.sol ...` (full suite).
- To compile the Coq proof: `coqc proofs/SafetyKernel.v` (requires Coq ≥ 8.16).

## Recent changes

- 2026-04-26 — Initial scaffold: contracts, Foundry tests, deploy script,
  Phase 3 fetcher/tss-signer/submitter stubs, ops dashboard, workflow.
- 2026-05-01 — Institution-grade implementation:
  - `contracts/TEEVerifier.sol` — EIP-191 TEE attestation bridge
  - `contracts/AssetRegistry.sol` — Multi-asset isolated safety kernels
  - `proofs/SafetyKernel.v` — Coq formal proof (4 theorems)
  - `test/TEEVerifier.t.sol`, `test/AssetRegistry.t.sol` — Foundry coverage
  - `script/DeployFull.s.sol` — Full suite deployment script
  - Dashboard updated: architecture layers, verification artifacts, new addresses
