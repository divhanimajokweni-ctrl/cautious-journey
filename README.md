# ProofBridge Liner — Stateful Risk Engine (v2)

Ghost-Risk Circuit-Breaker → Ubuntu stokvel execution loop deployed on Polygon Amoy.

---

## Current State

| Layer | Status | Detail |
|-------|--------|--------|
| `/api/verify` (Gate-1 v1) | ✅ Live | HMAC-SHA256 receipt; `anchored_at: null` by design |
| `/api/mint` (Gate-1 v2) | ✅ Live | `client_nonce` replay protection; `CIRCUIT_BREAKER_TRIPPED` on HALT |
| `POST /api/v2/events` | ✅ Code | α/β Bayesian update; replaces manual alpha/beta input |
| `POST /api/v2/decision` | ✅ Code | EIP-712 oracle verdict + signature + proposal auto-promotion |
| `POST /api/v2/payments/initiate` | ✅ Code | Stitch Instant EFT execution for `RISK_VERIFIED` proposals |
| `POST /api/v2/webhooks/stitch` | ✅ Code | HMAC-gated settlement webhook; closes risk-engine loop |
| `GET/POST /api/auth/*` | ✅ Code | SIWE nonce + wallet sig → HMAC-SHA256 JWT session |
| `UbuntuPoolsEngine.sol` | ✅ Code | Committee approval + 3-of-5 TSS quorum (deploy → Amoy → set env) |
| `RiskOracleVerifier.sol` | ✅ Code | EIP-712 oracle + TEEVerifier fallback + nonce nullification |
| `.local/state/db.json` | ⬜ Empty | File-backed KV store; auto-initialised on first v2 call |
| `db/schema.sql` | ✅ Ready | entities / proposals / decisions / events tables + FK + triggers |
| `services/security/eip712Signer.js` | ✅ Code | `signDecision()` / `verifySignature()` with ethers v6 |
| `services/gateway/stitchAdapter.js` | ✅ Code | OAuth2 + Instant EFT client (axios) |
| `services/execution/orchestrator.js` | ✅ Code | `executeApprovedProposal` + `runExecutionLoop(limit)` |
| `deploy/` | ✅ Code | Full auto-deploy pipeline (build → broadcast → verify → Vercel env → deploy → tag) |
| `.github/workflows/prod.yml` | ✅ Code | CI/CD: pre-flight gates → deploy → Slack alert |
| `DEPLOYER_PRIVATE_KEY` | ⬜ → rotate | Set in Vercel dashboard; **never commit**. The old key ending in `...f017fed6` was purged from git history on 2026-05-22. **_DO NOT REUSE_** |
| `polygon_amoy_rpc_url` | ⬜ Env | Polygon Amoy RPC endpoint |
| `polygonscan_api_key` | ⬜ Env | Contract verification on Amoy |
| `PROOFBRIDGE_HMAC_SECRET` | ⬜ Env | Must be set in Vercel dashboard; dev fallback is `dev-secret` — not safe for prod |
| `ORACLE_PRIVATE_KEY` | ⬜ Env | Required for EIP-712 signing (v2/decision) |
| `STITCH_CLIENT_ID / SECRET` | ⬜ Env | Required for SA banking execution (Stitch Money) |
| `STITCH_SECRET` | ⬜ Env | HMAC webhook verification (v2/webhooks/stitch) |
| `CONTRACT_ADDRESS` | ⬜ Env | RiskOracleVerifier on Polygon Amoy |
| UbuntuPoolsEngine deployed | ⬜ Pending | `forge script script/DeployUbuntuPoolsEngine.s.sol --rpc-url $RPC_URL --broadcast`_ or use `deploy/full_auto_deploy.sh` |

---

## Architecture (v2)

```
User Layer (vvv/ static)
  │
  ▼
V2 API (api/v2/*) ← EIP-712 / JWT signing
  │├─ POST /api/v2/events          → Bayesian α/β update
  │├─ POST /api/v2/decision        → oracle verdict + signature
  │├─ POST /api/v2/payments/{id}   → Stitch EFT trigger
  │└─ POST /api/v2/webhooks/stitch → settlement → risk update
  │
  ▼
Execution Orchestrator (services/execution/orchestrator.js)
  │├─ fetches RISK_VERIFIED proposals from .local/state/db.json
  │├─ calls StitchGatewayAdapter → Instant EFT
  │├─ writes EXECUTION_PENDING + POSITIVE event
  │└─ records decision ID (EIP-712 signed)
  │
  ▼
SA Banking Bridge (services/gateway/stitchAdapter.js)
  │├─ OAuth2 client_credentials
  │└─ /payments/instant-eft → Stitch Money
  │
  ▼
State Store (services/state/db.js)
  │├─ entities     (entity_id, alpha, beta, gamma, threshold, direction)
  │├─ proposals    (status pipeline: PENDING → RISK_VERIFIED → EXECUTION_PENDING → SETTLED)
  │├─ decisions    (EIP-712 signature + nonce + message_hash)
  │└─ events       (POSITIVE/NEGATIVE/NEUTRAL — feeds α/β)
  │
  ▼
On-Chain (Polygon Amoy)
  ├─ RiskOracleVerifier  ← EIP-712 decision → AssetRegistry
  ├─ UbuntuPoolsEngine   ← 3-of-5 TSS committee approval
  ├─ AssetRegistry       ← Per-proposal kernel tripping
  └─ CircuitBreakerV2    ← Threshold quorum (fallback path)

Auth (api/auth/*)
  ├─ GET  /api/auth/nonce    → SIWE challenge
  ├─ POST /api/auth/verify   → wallet sig → HMAC-SHA256 JWT
  ├─ GET  /api/auth/session  → Bearer validation
  └─ POST /api/auth/signout  → 204 discard
```

### State Machine

```
entities ─→ proposals ─→ decisions ─→ Stitch EFT → events ─→ α/β update
                             │                           │
                        PENDING                       POSITIVE / NEGATIVE
                             │
                       RISK_VERIFIED ← v2/decision
                             │
                       EXECUTION_PENDING ← v2/payments/initiate (Stitch)
                             │
                       SETTLED ← v2/webhooks/stitch (settlement confirmed)
```

---

## How to Use

### Prerequisites

| Need | Why |
|------|-----|
| `PROOFBRIDGE_HMAC_SECRET` set on Vercel | Signs every response `hmac-sha256:<hex>` |
| `"type": "module"` at repo root | All API handlers are ESM |
| Node.js ≥ 20 | `node --test`, `crypto` built-ins |
| `DEPLOYER_PRIVATE_KEY` on Vercel | Forge broadcast signing key — rotates per-network; **_DO NOT COMMIT_** |
| `ORACLE_PRIVATE_KEY` on Vercel | EIP-712 signing (v2/decision); defaults to `DEPLOYER_PRIVATE_KEY` if unset |
| `ORACLE_PUBLIC_KEY` on Vercel | EIP-712 verifying contract address |
| `CONTRACT_ADDRESS` on Vercel | RiskOracleVerifier on Polygon Amoy |
| `STITCH_CLIENT_ID / SECRET` on Vercel | SA banking execution via Stitch Money |
| `STITCH_SECRET` on Vercel | Webhook HMAC verification (v2/webhooks/stitch) |
| `POLYGON_AMOY_RPC_URL` on Vercel | Polygon Amoy RPC endpoint |
| `POLYGONSCAN_API_KEY` on Vercel | Contract verification on Etherscan/Amoy |

### Use case 1 — Minimal deed attestation (`/api/verify`)

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":2,"beta":1,"gamma":1.2,"threshold":0.95,
       "deed_hash":"a3f1...","issuer_did":"did:key:...","chain_target":"AMOY"}'
```

### Use case 2 — Replay-resistant minting (`/api/mint`)

```bash
CLIENT_NONCE=$(openssl rand -hex 32)
curl -X POST https://proofbridge-liner.vercel.app/api/mint \
  -H "Content-Type: application/json" \
  -d "{\"alpha\":4,...\"client_nonce\":\"${CLIENT_NONCE}\",\"chain_target\":\"AMOY\"}"
```

### Use case 3 — Stateful risk event feed (`/api/v2/events`)

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/v2/events \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"stokvel_123","direction":"POSITIVE","weight":3}'
# → { ok:true, event_id, entity_id, alpha, beta, posterior }
```

### Use case 4 — Oracle decision with EIP-712 (`/api/v2/decision`)

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/v2/decision \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"stokvel_123"}'
# → { ok:true, belief, threshold, verdict, signature, nonce, decision_id }
```

### Use case 5 — Initiate EFT payment (`/api/v2/payments/initiate`)

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/v2/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{"proposal_id":"<uuid>"}'
# → { ok:true, proposal_id, status:EXECUTION_PENDING, transaction_id }
```

### Use case 6 — Wallet auth (`/api/auth/*`)

```bash
curl https://proofbridge-liner.vercel.app/api/auth/nonce
# → { nonce, expires_in: 300 }

# Sign nonce in wallet, then:
curl -X POST https://proofbridge-liner.vercel.app/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"nonce":"<challenge>","address":"0x...","signature":"0x..."}'
# → { ok:true, session:{ token, address, expires_in:86400 } }
```

---

## Repository Structure

```
proofbridge-liner/
├── deploy/                          # Production deploy system
│   ├── full_auto_deploy.sh          # 12-step deploy pipeline (build → verify → tag)
│   ├── config.sh                    # Single source of truth (network, retry, env)
│   ├── utils.sh                     # retry / structured logging / require_env
│   ├── notify.sh                    # Slack + Telegram notification dispatcher
│   ├── extract_addresses.sh         # jq address parser from forge --json output
│   ├── rollback.sh                  # Snapshot restore + Vercel env rollback
│   └── logs/                        # Deploy artefact JSON + log files
├── api/
│   ├── verify.js                    # Gate-1 v1 — Bayesian HMAC receipt
│   ├── mint.js                      # Gate-1 v2 — + client_nonce replay protection
│   ├── stitch/webhook.js            # Stitch payment events
│   ├── pool-token/{verify,mint}.js  # JWT pool tokens
│   ├── svix/app-portal.js           # Svix webhook portal
│   ├── v2/
│   │   ├── events.js                # α/β Bayesian state update
│   │   ├── decision.js              # EIP-712 oracle verdict
│   │   ├── payments.js              # Stitch EFT execution bridge
│   │   └── webhooks/stitch.js       # Settlement feedback loop
│   ├── auth/{nonce,verify,session,signout}.js  # Wallet identity (SIWE + JWT)
│   └── package.json                 # { "type": "module" }
├── .github/workflows/
│   ├── prod.yml                     # CI/CD: pre-flight → deploy → failure alert
│   └── ci.yml                       # Unit tests + production smoke checks
├── contracts/
│   ├── AssetRegistry.sol            # Per-proposal isolated kernel
│   ├── BayesianScorer.sol           # On-chain Beta-Binomial
│   ├── CircuitBreaker.sol           # MVP oracle-only breaker
│   ├── CircuitBreakerV2.sol         # 3-of-5 TSS threshold quorum
│   ├── TEEVerifier.sol              # EIP-191 enclave attestations
│   ├── UbuntuPoolsEngine.sol        # ⭐ stokvel committee lifecycle
│   └── RiskOracleVerifier.sol       # ⭐ EIP-712 oracle + TEE fallback
├── services/
│   ├── security/eip712Signer.js     # EIP-712 Decision signer (ethers v6)
│   ├── state/db.js                  # File-backed KV store (.local/state/db.json)
│   ├── gateway/stitchAdapter.js     # Stitch Money OAuth2 + Instant EFT
│   ├── execution/orchestrator.js    # executeApprovedProposal + runExecutionLoop
│   └── lib/jwt.js                   # HMAC-SHA256 session JWT
├── script/                          # Foundry deploy scripts
│   ├── DeployFull.s.sol
│   ├── DeployUbuntuPoolsEngine.s.sol
│   ├── DeployRiskOracleVerifier.s.sol
│   ├── DeployCircuitBreaker.s.sol
│   └── DeployMockRealT.s.sol
├── db/schema.sql                    # SQL: entities | proposals | decisions | events
├── vvv/                             # Static site (Vercel Static Deploy)
├── dashboard/                       # Express ops daemon (port 5000, self-hosted)
├── vercel.json                      # All routes + functions config
├── .env.example                     # All required env vars documented (with blocked-key guard)
├── foundry.toml                     # Foundry 0.8.20 / Polygon Amoy
├── AGENTS.md                        # CI/CD Deploy Guard (single source of truth)
├── DEPLOYMENT.md                    # Branching + release strategy + blocked key guardrails
├── DEPLOY-PROD.md                   # Step-by-step production deploy runbook
└── STITCH_SETUP.md                  # Stitch Money banking bridge setup
```

---

## Route Map

| Route | Target | Method | Layer |
|-------|--------|--------|-------|
| `/` | `/vvv/index.html` | GET | Static |
| `/gate-1` | `/vvv/gate-1.html` | GET | Static |
| `/gateway` | `/vvv/gate-1.html` | GET | Static (alias) |
| `/pools` | `/vvv/pools.html` | GET | Static |
| `/proofbridge` | `/vvv/proofbridge.html` | GET | Static |
| `/whatsonboarding.html` | `/vvv/whatsonboarding.html` | GET | Static |
| `/dashboard` | `/vvv/dashboard.html` | GET | Static |
| `/submission` | `/vvv/submission.html` | GET | Static |
| `POST /api/verify` | `api/verify.js` | POST | v1 |
| `POST /api/mint` | `api/mint.js` | POST | v1 |
| `POST /api/v2/events` | `api/v2/events.js` | POST | v2 |
| `POST /api/v2/decision` | `api/v2/decision.js` | POST | v2 |
| `POST /api/v2/payments/initiate` | `api/v2/payments.js` | POST | v2 |
| `POST /api/v2/webhooks/stitch` | `api/v2/webhooks/stitch.js` | POST | v2 |
| `GET /api/auth/nonce` | `api/auth/nonce.js` | GET | Auth |
| `POST /api/auth/verify` | `api/auth/verify.js` | POST | Auth |
| `GET /api/auth/session` | `api/auth/session.js` | GET | Auth |
| `POST /api/auth/signout` | `api/auth/signout.js` | POST | Auth |
| `/api/health` | `api/verify.js` | GET | v1 (405→POST only) |
| `/api/status` | `api/verify.js` | GET | v1 (405→POST only) |
| `/api/no-such-route` | `/vvv/404.html` | * | 404 |

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://proofbridge-liner.vercel.app/ | VVU gateway |
| https://proofbridge-liner.vercel.app/proofbridge | ProofBridge Liner landing |
| https://proofbridge-liner.vercel.app/gate-1 | Gate-1 terminal UI |
| https://proofbridge-liner.vercel.app/gateway | Gateway alias → Gate-1 |
| https://proofbridge-liner.vercel.app/pools | Ubuntu Pools |
| https://proofbridge-liner.vercel.app/api/verify | Gate-1 v1 POST |
| https://proofbridge-liner.vercel.app/api/mint | Gate-1 v2 POST |

---

## Deployment Steps

### 0. Environment (Vercel Dashboard → Environment Variables → Production)

All required variables — set via the Vercel dashboard; **never commit to git**.

| Variable | Purpose |
|----------|---------|
| `DEPLOYER_PRIVATE_KEY` | Forge broadcast signing key — **rotates per-network; never commit** |
| `ORACLE_PRIVATE_KEY` | EIP-712 signing key (v2/decision); defaults to `DEPLOYER_PRIVATE_KEY` if unset |
| `ORACLE_PUBLIC_KEY` | EIP-712 verifying contract address |
| `CONTRACT_ADDRESS` | RiskOracleVerifier on Polygon Amoy |
| `POOLS_ENGINE_ADDRESS` | UbuntuPoolsEngine on Amoy (empty on first deploy; filled by pipeline) |
| `PROOFBRIDGE_HMAC_SECRET` | HMAC-SHA256 JWT + response-signing secret |
| `STITCH_CLIENT_ID` | Stitch Money OAuth2 client ID |
| `STITCH_CLIENT_SECRET` | Stitch Money OAuth2 client secret |
| `STITCH_SECRET` | Svix/Stitch webhook HMAC verification |
| `POLYGON_AMOY_RPC_URL` | https://rpc-amoy.polygon.technology |
| `POLYGONSCAN_API_KEY` | Etherscan / Amoy contract verification |

> ⛔ **Blocked key**: `0xb25939caa5515f9ded22aedf08ce0ec6778ac2ef5e11cadef24bff24f017fed6` — purged from git history on 2026-05-22. If this key suffix appears in your GitHub Secrets, **rotate immediately** and move all funds from the associated wallet.

### 1. Quick deploy — full auto pipeline (recommended)

```bash
export NETWORK=amoy                                          # or: NETWORK=polygon
export DEPLOYER_PRIVATE_KEY=0x<new-rotated-key>
export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
export POLYGONSCAN_API_KEY=<your-key>
export VERCEL_TOKEN=<vercel-api-token>
export VERCEL_PROJECT_ID=<project-id>
export VERCEL_ORG_ID=<org-id>
export PROOFBRIDGE_HMAC_SECRET=<hmac-secret>
export ORACLE_PRIVATE_KEY=0x<oracle-key>
export ORACLE_PUBLIC_KEY=<oracle-address>
export CONTRACT_ADDRESS=<risk-oracle-verifier>
export STITCH_CLIENT_ID=<stitch-client-id>
export STITCH_CLIENT_SECRET=<stitch-client-secret>
export STITCH_SECRET=<stitch-webhook-secret>
# POOLS_ENGINE_ADDRESS left empty on first deploy; pipeline fills it in

bash deploy/full_auto_deploy.sh
```

What happens:
1. `forge build` — compile all contracts
2. Deploy `UbuntuPoolsEngine` → save JSON artefact
3. Deploy `RiskOracleVerifier` → save JSON artefact
4. `deploy/extract_addresses.sh` — parse `POOLS_ENGINE_ADDRESS` + `ORACLE_ADDRESS` from broadcast JSON
5. `forge verify-contract` — submit to Amoy Etherscan
6. Save rollback snapshot → `deploy/snapshots/rollback_*.env`
7. `deploy/rollback.sh` — Vercel env upsert for all 12 production vars
8. `npx vercel deploy --prod` — frontend deploy
9. `git tag deploy-<network>-<timestamp>` → push tag to origin
10. Slack/Telegram notify on success

### 2. CI/CD — GitHub Actions (`.github/workflows/prod.yml`)

Pre-flight gates run **before any push to `production` branch or `vercel --prod`**:
1. `node --check` on every `api/auth/*.js` handler
2. `grep '"src"' vercel.json` — ensure no shadowing `/api/(.*)` catch-all
3. `git log -S 'b25939...f017fed6'` — abort if the blocked key leaks back in
4. Manual trigger requires `confirm_prod=yes`

Post-deploy: Slack alert on failure.

### 3. Manual deploy — contracts only

```bash
# Deploy UbuntuPoolsEngine
forge script script/DeployUbuntuPoolsEngine.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# Deploy RiskOracleVerifier
forge script script/DeployRiskOracleVerifier.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

Paste contract addresses from console output into Vercel env as:
`POOLS_ENGINE_ADDRESS`, `ORACLE_PUBLIC_KEY`, `CONTRACT_ADDRESS`.

### 4. Push API to Vercel

```bash
git push origin gate-1           # push branch
npx vercel --confirm --prod       # deploy to production
```

### 5. Post-deploy verification

```bash
curl -sf https://proofbridge-liner.vercel.app/ | head -c 300
curl -sf https://proofbridge-liner.vercel.app/gate-1 | grep -c SafeBridge
curl -sf https://proofbridge-liner.vercel.app/pools | grep -c Ubuntu
curl -sf https://proofbridge-liner.vercel.app/gateway | grep -c SafeBridge
curl -sf https://proofbridge-liner.vercel.app/whatsonboarding.html | grep -c Onboarding
curl -sf https://proofbridge-liner.vercel.app/submission | grep -c Deliverables
```

---

## Invariants

```
POST /api/verify  →  { ok:true, posterior, verdict, receipt_id, pipeline_hash,
                      anchored_at:null, signature, safegrid_signal }

POST /api/mint    →  { status, payload:{ ok, verdict, anchored_at:null,
                      pipeline_hash, receipt_id, ... }, signature }
```

No `anchored_at` field ever arrives with a non-null value.
No `safefgrid_signal` (typo) field ever appears in any response.

---

## Known Weaknesses

| Weakness | Impact | Status |
|----------|--------|--------|
| No `calibrated_threshold` in `/api/verify` | Cannot display τ alongside μ in v1 integrations | Use `/api/mint` |
| `anchored_at` always `null` | On-chain anchoring is design-only | Next sprint |
| Stitch credentials not set in Vercel | v2 payments will 500 until configured | Blocking — set via Vercel dashboard |
| `ORACLE_PRIVATE_KEY` not set in Vercel | v2/decision will 503 until configured | Blocking — set via Vercel dashboard |
| UbuntuPoolsEngine not yet deployed to Amoy | Pools engine live on-chain | Deploy via `bash deploy/full_auto_deploy.sh` |

---

## Invariants

- `anchored_at` is always `null` in all proof responses (contract invariant)
- No `safefgrid_signal` typo field appears (spelling always `safegrid_signal`)
- Chain allowlist only accepts `AMOY` and `FABRIC`; `MAINNET` is rejected before computation
- Private keys must never appear as plaintext literals in committed code — they always come from Vercel Secrets or environment variables
- The blocked key `0xb259...f017fed6` is actively scanned by the CI/CD deploy gate on every push

---

## See Also

| Document | Purpose |
|----------|---------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Branching strategy + release process |
| [`DEPLOY-PROD.md`](DEPLOY-PROD.md) | Step-by-step production runbook |
| [`AGENTS.md`](AGENTS.md) | CI/CD Deploy Guard — enforced pre-push/prod lock |
| `.github/workflows/prod.yml` | GitHub Actions CD pipeline |
| [`STITCH_SETUP.md`](STITCH_SETUP.md) | Stitch Money SA banking bridge setup |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Full system architecture |
| [`TESTING.md`](TESTING.md) | Test results and integration coverage |
| `deploy/` | Production deploy system (scripts + CI) |

---

# ProofBridge Liner
Vaguely Vanity LLC · Gqeberha, ZA
MIT
