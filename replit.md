# ProofBridge Liner — Replit Project Notes

## Current Role

Replit is the autoscale dashboard/runtime surface for ProofBridge Liner. Production public traffic is served by Vercel at:

```txt
https://venturevisionubuntu.co.za
```

The typo domain `venturevisualubuntu.co.za` is not used.

## Runtime

- Node module: `nodejs-20`
- Workflow: `Start application`
- Workflow command: `npm run start`
- Server: `dashboard/server.js`
- Local port: `5000`
- Deployment target: `autoscale`
- Deployment run command: `node dashboard/server.js`

## What this project is

ProofBridge Liner is a Ghost-Risk Circuit-Breaker and VVU/Ubuntu Pools operating surface. It combines:

1. Public VVU and Ubuntu Pools static pages under `vvv/`.
2. Vercel API routes under `api/`.
3. Existing prover and contract safety-kernel components.
4. A TypeScript cryptographic compliance execution fabric for signed SARB/BOP3-style evidence artifacts.

## Production State

Verified during the current sync:

```txt
https://venturevisionubuntu.co.za              HTTP 200
https://venturevisionubuntu.co.za/api/health   HTTP 200
DNS A venturevisionubuntu.co.za                76.76.21.21
```

Current production deployment:

```txt
proofbridge-liner-qcfdfyoch-divhanimajokweni-1651s-projects.vercel.app
```

## Key Commands

Install dependencies:

```bash
npm install
```

Run Replit dashboard/runtime:

```bash
npm run start
```

Run TypeScript compliance verification:

```bash
npm test
```

Generate local RSA keys for mock compliance testing:

```bash
npm run keys
```

Generated keys are local-only and ignored by Git:

```txt
private_key.pem
public_key.pem
```

## Project Layout

```txt
api/                         Vercel serverless API routes
vvv/                         Production static VVU and Ubuntu Pools pages
dashboard/                   Express dashboard/runtime for Replit
contracts/                   Solidity contracts
proofs/                      Formal verification artifacts
prover/                      Existing JS prover scripts plus TS compliance tokenizer
server/mock_sarb_endpoint.ts Mock SARB compliance ingest endpoint
test/verification_loop.test.ts Compliance verification loop
scripts/generate_keys.mjs    Local RSA key generation
```

## Environment Variables

Use Replit Secrets or provider environment settings. Do not commit real values.

```txt
KERNEL_SECRET
POLYGON_AMOY_RPC_URL
PRIVATE_KEY
CIRCUIT_BREAKER_ADDRESS
ASSET_REGISTRY_ADDRESS
TEE_VERIFIER_ADDRESS
ORACLE_ADDRESS
ENCLAVE_ADDRESS
POLYGONSCAN_API_KEY
```

## Git/Vercel Sync Notes

- Clean PR branch: `compliance-fabric`
- Base branch: `origin/main`
- Do not use the suspicious deployment replay branch `gate-1` for the production sync.
- Git origin should be token-free:

```txt
https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
```

## Security Notes

- Do not commit `.env`, private keys, generated PEM files, `dist/`, or `node_modules/`.
- Rotate any credential that appeared in local `.git/config` or old docs.
- Keep operational tokens in provider secrets only.
