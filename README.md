# ProofBridge Liner — Stateful Risk Engine (v2)

Ghost-Risk Circuit-Breaker → Ubuntu stokvel execution loop deployed on Polygon Amoy.

---

## Current State

| Layer | Status | Detail |
|-------|--------|--------|
| `/api/verify` (Gate-1 v1) | ✅ Live | `anchored_at: null`, `safegrid_signal`, `hmac-sha256` |
| `/api/mint` (Gate-1 v2) | ✅ Live | `client_nonce` replay protection; `CIRCUIT_BREAKER_TRIPPED` on HALT |
| `POST /api/v2/events` | ✅ Code | α/β Bayesian update; replaces manual alpha/beta input |
| `POST /api/v2/decision` | ✅ Code | EIP-712 oracle verdict + signature + proposal auto-promotion |
| `POST /api/v2/payments/initiate` | ✅ Code | Stitch Instant EFT execution for `RISK_VERIFIED` proposals |
| `POST /api/v2/webhooks/stitch` | ✅ Code | HMAC-gated settlement webhook; closes risk-engine loop |
| `GET/POST /api/auth/*` | ✅ Code | SIWE nonce + wallet sig → JWT session |
| `UbuntuPoolsEngine.sol` | ✅ Code | Committee approval + 3-of-5 TSS quorum (deploy → Amoy → set env) |
| `RiskOracleVerifier.sol` | ✅ Code | EIP-712 oracle + TEEVerifier fallback + nonce nullification |
| `.local/state/db.json` | ⬜ Empty | File-backed KV store; auto-initialised on first v2 call |
| `db/schema.sql` | ✅ Ready | entities / proposals / decisions / events tables + FK + triggers |
| `services/security/eip712Signer.js` | ✅ Code | `signDecision()` / `verifySignature()` with ethers v6 |
| `services/gateway/stitchAdapter.js` | ✅ Code | OAuth2 + Instant EFT client (axios) |
| `services/execution/orchestrator.js` | ✅ Code | `executeApprovedProposal` + `runExecutionLoop(limit)` |
| `PROOFBRIDGE_HMAC_SECRET` | ⬜ Env | Must be set in Vercel dashboard; dev fallback is `dev-secret` |
| `ORACLE_PRIVATE_KEY` | ⬜ Env | Required for EIP-712 signing (v2/decision) |
| `STITCH_CLIENT_ID / SECRET` | ⬜ Env | Required for SA banking execution (Stitch Money) |
| `STITCH_SECRET` | ⬜ Env | HMAC webhook verification (v2/webhooks/stitch) |
| `CONTRACT_ADDRESS` | ⬜ Env | RiskOracleVerifier on Polygon Amoy |
| UbuntuPoolsEngine deployed | ⬜ Pending | `forge script script/DeployUbuntuPoolsEngine.s.sol --rpc-url $RPC --broadcast` |
| Vercel aliases reduced to 1 | ⬜ Manual | `npx vercel ls` shows 4 Production entries for same project |

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
| *[new]* `ORACLE_PRIVATE_KEY` on Vercel | EIP-712 signing (v2/decision) |
| *[new]* `ORACLE_PUBLIC_KEY` on Vercel | EIP-712 verifying contract |
| *[new]* `CONTRACT_ADDRESS` on Vercel | RiskOracleVerifier contract address |
| *[new]* `STITCH_CLIENT_ID/SECRET` on Vercel | SA banking execution |
| *[new]* `STITCH_SECRET` on Vercel | Webhook HMAC verification |

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
├── api/
│   ├── verify.js              # Gate-1 v1 — Bayesian HMAC receipt
│   ├── mint.js                # Gate-1 v2 — + client_nonce replay protection
│   ├── stitch/webhook.js       # Stitch payment events
│   ├── pool-token/{verify,mint}.js  # JWT pool tokens
│   ├── svix/app-portal.js       # Svix webhook portal
│   ├── v2/
│   │   ├── events.js            # α/β Bayesian state update
│   │   ├── decision.js          # EIP-712 oracle verdict
│   │   ├── payments.js          # Stitch EFT execution bridge
│   │   └── webhooks/stitch.js   # Settlement feedback loop
│   ├── auth/{nonce,verify,session,signout}.js  # Wallet identity
│   └── package.json             # { "type": "module" }
├── contracts/
│   ├── AssetRegistry.sol         # Per-proposal isolated kernel
│   ├── BayesianScorer.sol        # On-chain Beta-Binomial
│   ├── CircuitBreaker.sol        # MVP oracle-only breaker
│   ├── CircuitBreakerV2.sol      # 3-of-5 TSS threshold quorum
│   ├── TEEVerifier.sol           # EIP-191 enclave attestations
│   ├── UbuntuPoolsEngine.sol     # ⭐ NEW stokvel committee lifecycle
│   └── RiskOracleVerifier.sol    # ⭐ NEW EIP-712 oracle + TEE fallback
├── services/
│   ├── security/eip712Signer.js  # EIP-712 Decision signer (ethers v6)
│   ├── state/db.js               # File-backed KV store (.local/state/db.json)
│   ├── gateway/stitchAdapter.js  # Stitch Money OAuth2 + Instant EFT
│   ├── execution/orchestrator.js # executeApprovedProposal + runExecutionLoop
│   └── lib/jwt.js                # HMAC-SHA256 session JWT (no deps)
├── db/schema.sql                 # SQL: entities | proposals | decisions | events
├── vvv/                          # Static site (Vercel Static Deploy)
│   ├── index.html               # VVU Ant-Kernel homepage
│   ├── gate-1.html              # SafeBridge Gate-1 Terminal
│   ├── pools.html               # Ubuntu Pools ROSCA landing
│   ├── proofbridge.html         # ProofBridge Liner landing
│   ├── dashboard.html           # Secure Console (pool-token gated)
│   ├── whatsonboarding.html     # WhatsApp onboarding demo
│   └── submission.html          # Hackathon submission tracker
├── dashboard/                    # Express ops daemon (port 5000, local/Replit only)
├── vercel.json                   # All routes + builds (v1 + v2 + auth)
├── .env.example                  # All required env vars documented
├── foundry.toml                  # Foundry 0.8.20 / Polygon Amoy
├── AGENTS.md                     # CI/CD Deploy Guard (single source of truth)
└── DEPLOYMENT.md                 # Branching + release strategy
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

### 1. Environment (Vercel Dashboard → Environment Variables → Production)

```bash
# v1
PROOFBRIDGE_HMAC_SECRET=<64-char hex secret>

# v2 — decision engine
ORACLE_PRIVATE_KEY=<oracle private key>
ORACLE_PUBLIC_KEY=<oracle / verifying contract address>
CONTRACT_ADDRESS=<RiskOracleVerifier on Amoy>

# v2 — execution bridge
STITCH_CLIENT_ID=<Stitch OAuth2 client ID>
STITCH_CLIENT_SECRET=<Stitch OAuth2 client secret>
STITCH_SECRET=<Stitch webhook HMAC secret>

# v2 — pools
POOLS_ENGINE_ADDRESS=<UbuntuPoolsEngine on Amoy>

# Local / self-hosted
DB_PATH=.local/state/db.json
```

### 2. Deploy contracts (Polygon Amoy)

```bash
# Deploy UbuntuPoolsEngine
forge script script/DeployUbuntuPoolsEngine.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast

# Deploy RiskOracleVerifier (wraps AssetRegistry + TEEVerifier)
forge script script/DeployRiskOracleVerifier.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast
```

### 3. Deploy API to Vercel

```bash
git push origin gate-1      # push branch
npx vercel --confirm --prod # deploy to production
```

### 4. Post-deploy verification

```bash
curl -sf https://proofbridge-liner.vercel.app/ | head -c 300
curl -sf https://proofbridge-liner.vercel.app/gate-1 | grep -c SafeBridge
curl -sf https://proofbridge-liner.vercel.app/pools | grep -c Ubuntu
curl -sf https://proofbridge-liner.vercel.app/gateway | grep -c SafeBridge
curl -sf https://proofbridge-liner.vercel.app/whatsonboarding.html | grep -c Onboarding
curl -sf https://proofbridge-liner.vercel.app/submission | grep -c Deliverables
```

### 5. Execution loop

```bash
# Dry-run: lists RISK_VERIFIED proposals, performs no API calls
node -e "import { runExecutionLoop } from './services/execution/orchestrator.js'; console.log(await runExecutionLoop(10));"

# Live: executes Stitch payments for each RISK_VERIFIED proposal
node -e "import { runExecutionLoop } from './services/execution/orchestrator.js'; console.log(await runExecutionLoop(null, { live: true }));"
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
| Stitch credentials env vars not set | v2 payments pipeline will 500 until configured | Blocking — set in Vercel dashboard |
| oracle private key env var not set | v2/decision will 503 until ORACLE_PRIVATE_KEY configured | Blocking |
| Vercel aliases > 1 | `npx vercel ls` shows 4 Production entries for same project | Manual dashboard cleanup required |

---

## Invariants

- `anchored_at` is always `null` in all proof responses (contract invariant)
- No `safefgrid_signal` typo field appears (spelling always `safegrid_signal`)
- Chain allowlist only accepts `AMOY` and `FABRIC`; `MAINNET` is rejected before computation

---

# ProofBridge Liner
Vaguely Vanity LLC · Gqeberha, ZA
MIT
