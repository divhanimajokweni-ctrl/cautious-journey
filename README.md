# ProofBridge Liner

> Ghost-Risk Circuit-Breaker for tokenised real-world assets — 72-hour MVP.

A 5-line `_beforeTokenTransfer` hook in any ERC-20 calls
`CircuitBreaker.validate(assetId, expectedHash)`. If the latest oracle-pushed
deed-hash for that asset does not match, the transfer reverts. If the global
circuit has been tripped, all gated transfers revert.

## Layout

```
proofbridge-liner/
├── contracts/        # CircuitBreaker.sol, IProofHook.sol, mock/MockRealT.sol
├── test/             # Foundry tests (CircuitBreaker.t.sol)
├── script/           # Foundry deploy scripts
├── prover/           # fetcher.js, tss-signer.js, submitter.js
├── signer-nodes/     # mock 3-of-5 quorum (Phase 4 — Docker compose)
├── config/           # assets.json, signer-nodes.json
├── dashboard/        # Express ops dashboard (port 5000)
├── foundry.toml
└── package.json
```

## Phases

| # | Phase                          | Status |
|---|--------------------------------|--------|
| 0 | Env scaffold                   | done   |
| 1 | Write & test CircuitBreaker    | done   |
| 2 | Deploy to Polygon Amoy         | in progress |
| 3 | Build fetcher + submitter      | in progress |
| 4 | Mock 3-node quorum (Docker)    | next   |
| 5 | E2E demo recording             | —      |
| 6 | Ghost-risk audit & pitch       | —      |

## Local development

```bash
# 1. Start the operations dashboard (auto-runs in Replit)
npm install
npm run start                     # http://localhost:5000

# 2. Run the off-chain prover once
node prover/fetcher.js

# 3. Foundry (requires `forge`)
forge test -vvv
forge script script/DeployCircuitBreaker.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast --verify
```

Copy `.env.example` to `.env` and fill in:

```
POLYGON_AMOY_RPC_URL=
PRIVATE_KEY=
ORACLE_ADDRESS=
POLYGONSCAN_API_KEY=
CIRCUIT_BREAKER_ADDRESS=     # populated after Phase 2 deploy
```

## Trust model

- **MVP** — single oracle address may push proofs and trip the circuit; owner may reset.
- **Post-PMF** — `onlyOracle` is replaced by EIP-712 verification of a 3-of-5
  ECDSA quorum. The on-chain interface is stable; `signer-nodes/` exists today
  as a Docker scaffold for that quorum.
