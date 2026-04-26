# ProofBridge Liner — Replit Project Notes

## What this project is

A 72-hour MVP for a **Ghost-Risk Circuit-Breaker** that any tokenised
real-world asset (e.g. a RealT property token) can integrate with a
5-line `_beforeTokenTransfer` hook. The on-chain `CircuitBreaker.sol`
contract is fed deed hashes by an off-chain prover; if the deed bytes
on IPFS no longer hash to the expected value, transfers revert.

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

## What still requires the user

- `forge` is not installed in the Replit container by default. The
  Foundry test/deploy commands (`forge test`, `forge script ...`)
  are intended to be run locally or in CI, not from inside the dashboard.
- To actually deploy to Polygon Amoy, copy `.env.example` to `.env`
  and fill in `POLYGON_AMOY_RPC_URL`, `PRIVATE_KEY`, `ORACLE_ADDRESS`,
  and `POLYGONSCAN_API_KEY`.
- After deploying, set `CIRCUIT_BREAKER_ADDRESS` in the env so the
  dashboard surfaces the live address.

## Recent changes

- 2026-04-26 — Initial scaffold: contracts, Foundry tests, deploy script,
  Phase 3 fetcher/tss-signer/submitter stubs, ops dashboard, workflow,
  autoscale deployment configured.
