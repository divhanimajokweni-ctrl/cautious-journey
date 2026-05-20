# ProofBridge Liner

ProofBridge Liner is the production shell for the Venture Vision Ubuntu / Ubuntu Pools safety kernel. It serves the public VVU experience, pool journey pages, verification API routes, and a new cryptographic compliance execution fabric for SARB/BOP3-style regulatory evidence.

## Current Production State

- Production domain: https://venturevisionubuntu.co.za
- Current Vercel deployment: `proofbridge-liner-qcfdfyoch-divhanimajokweni-1651s-projects.vercel.app`
- Production alias verified: `venturevisionubuntu.co.za -> proofbridge-liner-qcfdfyoch-divhanimajokweni-1651s-projects.vercel.app`
- DNS apex: `venturevisionubuntu.co.za -> 76.76.21.21`
- Health route: https://venturevisionubuntu.co.za/api/health
- Active clean integration branch: `compliance-fabric`
- Suspicious deployment replay branch: `gate-1` is intentionally not the source of this clean production sync.

The typo domain `venturevisualubuntu.co.za` was removed from Vercel. Use `venturevisionubuntu.co.za` everywhere.

## Operational Surfaces

### Vercel

Vercel serves the static VVU pages and serverless API routes from `vercel.json`.

Important routes:

```txt
/                  -> /vvv/index.html
/gate-1            -> /vvv/gate-1.html
/pools             -> /vvv/pools.html
/pools/onboarding  -> /vvv/pools-onboarding.html
/pools/trust       -> /vvv/pools-trust.html
/pools/ledger      -> /vvv/pools-ledger.html
/pools/governance  -> /vvv/pools-governance.html
/pools/learning    -> /vvv/pools-learning.html
/pools/profile     -> /vvv/pools-profile.html
/pools/compliance  -> /vvv/pools-compliance.html
/admin/pools       -> /vvv/admin-pools.html
/api/health        -> /api/verify.js
/api/status        -> /api/verify.js
/api/verify        -> /api/verify.js
/api/mint          -> /api/mint.js
```

Deploy production from the clean worktree/branch:

```bash
vercel deploy --prod --yes
vercel alias set <deployment-url> venturevisionubuntu.co.za
```

Verify after deploy:

```bash
curl -I https://venturevisionubuntu.co.za
curl -I https://venturevisionubuntu.co.za/api/health
```

Expected: `HTTP/1.1 200 OK`.

### Replit

Replit remains configured as an autoscale dashboard/runtime surface using Node.js 20 and `dashboard/server.js`.

- Workflow: `Start application`
- Command: `npm run start`
- Local app port: `5000`
- Deployment target: `autoscale`

### Git

Use the token-free origin URL:

```bash
git remote set-url origin https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
```

Do not commit generated key material, `dist/`, `node_modules/`, local Vercel output, or personal `.env` files.

## Cryptographic Compliance Execution Fabric

The TypeScript compliance fabric adds deterministic, signed compliance artifacts without changing the existing VVU production routes.

Core files:

```txt
prover/compliance_tokenizer.ts       RS256 pool tokens and signed compliance envelopes
server/mock_sarb_endpoint.ts         Mock SARB ingest endpoint for signature verification
scripts/generate_keys.mjs            Local RSA keypair generation
 test/verification_loop.test.ts       End-to-end verification loop
tsconfig.json                        Strict TypeScript build config
report_and_justification_mapping.txt Design rationale and mapping
```

The compliance artifact binds:

- financial payload
- SARB/BOP3-aligned telemetry
- posterior/threshold/safety-margin/verdict consistency
- hardware attestation hash
- canonical JSON payload hash
- RS256 signature

Verification fails closed on malformed, unsigned, or tampered packets.

## Local Setup

Use Node.js 22 LTS for the compliance TypeScript workflow.

```bash
npm install
npm run build
npm test
```

Expected verification output:

```txt
ISOLATED_MEMORY_BOUNDS_AND_SYNTAX_PARSE_PASS
ASYMMETRIC_JWT_CRYPTOGRAPHIC_VERIFICATION_PASS
SARB_BOP3_ISO20022_SERIALIZATION_PASS
TIMING_PATHWAY_REAUDIT_PASS
FINAL_EXECUTION_CORRECTNESS_PASS
```

Generate local RSA keys only when needed:

```bash
npm run keys
```

This creates `private_key.pem` and `public_key.pem`, both ignored by Git.

Start the mock SARB endpoint:

```bash
npm run server:webhook
```

Endpoint:

```txt
POST http://localhost:8080/api/sarb/bop3-ingest
```

## Existing Safety Kernel

The legacy ProofBridge safety kernel remains present in this repository:

- `api/verify.js` and `api/mint.js` for Vercel routes
- `contracts/` for Solidity safety-kernel contracts
- `proofs/` for formal verification artifacts
- `prover/*.js` for existing off-chain prover workflows
- `dashboard/server.js` for the Replit/Express dashboard

## Security Notes

- Never embed GitHub, Hugging Face, Vercel, wallet, or RPC secrets in `.git/config`, docs, examples, or committed env files.
- Use token-free remote URLs and a credential manager or environment-scoped auth.
- Treat `private_key.pem`, `.env`, `.env.*`, `dist/`, and `node_modules/` as local/generated artifacts.
- Rotate any token or private key that previously appeared in local config or documentation.

## Production Verification Snapshot

Last verified during this sync:

```txt
https://venturevisionubuntu.co.za              HTTP 200
https://venturevisionubuntu.co.za/api/health   HTTP 200
DNS A venturevisionubuntu.co.za                76.76.21.21
```
