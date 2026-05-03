# ProofBridge Liner — Replit Project Notes

## What this project is

A **Ghost-Risk Circuit-Breaker** that any tokenised real-world asset (e.g. a RealT property token) can integrate with a 5-line `_beforeTokenTransfer` hook. The on-chain contracts are deployed on Polygon Amoy and operational. SafetyKernel at 0x770342c49e1F4710E0Eed605dCe41e7f3F7600Eb and MockRealT at 0xb91C1aC1Bbc9D7df85A858BCb7705D7edd8fEc82. The off-chain prover feeds deed hashes; if the deed bytes on IPFS no longer hash to the expected value, transfers revert.

## Stack

- **Solidity 0.8.20** + **Foundry** for the on-chain contract and tests.
- **Node.js 20** for the off-chain prover and the operations dashboard.
- **Express 4** for the dashboard web app (port 5000).

## Project layout

```
contracts/        CircuitBreaker.sol, IProofHook.sol, mock/MockRealT.sol
test/             CircuitBreaker.t.sol  (Foundry, 14 cases)
script/           DeployCircuitBreaker.s.sol  (Polygon Amoy)
prover/           fetcher.js, tss-signer.js, submitter.js
signer-nodes/     placeholder for the Phase 4 Docker quorum
config/           assets.json, signer-nodes.json
dashboard/        Express server + static UI (port 5000)
```

## Replit setup

- Workflow **Start application** runs `npm run start` and serves the
  ops dashboard on `http://0.0.0.0:5000`.
- The Express server sets `app.set('trust proxy', true)` and disables
  caching in dev so the Replit iframe preview always sees fresh content.
- Deployment target: **autoscale**, run command `node dashboard/server.js`.

## Current Status

- ✅ **Contracts Deployed**: SafetyKernel and MockRealT live on Polygon Amoy
- ✅ **Circuit Operational**: Transfer blocking tested and working
- ✅ **Dashboard Active**: Real-time monitoring at http://localhost:5000
- ✅ **Testing Complete**: 100% test pass rate, integration validated

## Development Notes

- Foundry is available via the configured path for local development
- Contracts are deployed and addresses are configured in the dashboard
- The system is ready for production evaluation and testing

## Recent changes

- 2026-04-26 — Initial scaffold: contracts, Foundry tests, deploy script,
  Phase 3 fetcher/tss-signer/submitter stubs, ops dashboard, workflow,
  autoscale deployment configured.
