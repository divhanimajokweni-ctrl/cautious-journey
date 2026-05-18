# ProofBridge Liner — Gate-1 Deployed

One-door verification corridor. POST `/api/verify` or POST `/api/mint`.
No ambiguity. Deeds have anchors.

---

## Current State

| Layer | Status | Detail |
|-------|--------|--------|
| `/api/verify` (Gate-1 v1) | ✅ Live | Sole proof computation path. `anchored_at: null`, `safegrid_signal`, `hmac-sha256` |
| `/api/mint` (Gate-1 v2) | ✅ Live | Same proof path + `client_nonce` replay protection; `CIRCUIT_BREAKER_TRIPPED` on HALT |
| `/gate-1` UI terminal | ✅ Live | `https://proofbridge-liner.vercel.app/gate-1` — human-readable contract summary |
| production `PROOFBRIDGE_HMAC_SECRET` | ✅ Set | Encrypted, 64-char hex; dev fallback (`dev-secret`) only for local unit tests |
| CI smoke tests | ✅ Passing | `node --test` locally; GitHub Actions step posts to deployed production |
| legacy `vvv/api/verify.js` | ✅ Deprecated | Moved to `deprecated/vvv-api/verify.legacy.js`. Do not import. |
| `/gate-1` route in `vercel.json` | ✅ First entry | Resolves before the `/api/*` catch-all |
| on-chain Merkle/anchor | ⬜ Design-only | `anchored_at` is always `null` today. Deployment is the next sprint. |
| audit-trail completeness | ⬜ Partial | `calibrated_threshold` field present in `api/mint` only; `api/verify` omits it (GET pairing limitation below) |

---

## How to Use

### Pre-requisites

| Need | Why |
|------|-----|
| `PROOFBRIDGE_HMAC_SECRET` set on Vercel | Signs every response with `hmac-sha256:<hex>` |
| `"type": "module"` at repo root | Both API handlers are ESM; missing this breaks Vercel cold-start |
| Node.js ≥ 20 (local) | `node --test`, `createHash`, `createHmac`, `randomUUID` are all built-in |

---

### Use case 1 — Minimal deed attestation (`/api/verify`)

**When to use:** you have a deed hash, want a server-signed receipt, and don't need replay protection.

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "alpha": 2, "beta": 1, "gamma": 1.2, "threshold": 0.95,
    "deed_hash": "a3f1e2d4b5c67890123456789abcdef0123456789abcdef0123456789abcdef01",
    "issuer_did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "property_ref": "prop_gate_1_smoke",
    "chain_target": "AMOY"
  }'
```

| Field | Always present | Notes |
|-------|---------------|-------|
| `ok: true` | ✅ | — |
| `posterior` | ✅ | `[0, 1]`, 6 decimals |
| `threshold` | ✅ | Echoed from request |
| `verdict` | ✅ | `PASS \| WARN \| HALT` |
| `receipt_id` | ✅ | UUID v4, server-generated |
| `pipeline_hash` | ✅ | 64-hex `sha256(handshake + envelope)` |
| `anchored_at` | ✅ | **Always `null`** — contract invariant |
| `signature` | ✅ | `hmac-sha256:<hex>` |
| `safegrid_signal` | ✅ | `{ evaluator_version, verdict, signal_id }` |
| `calibrated_threshold` | ⬜ | Present in `/api/mint` only; `api/verify` does not include this field when pairing at the moment; the pairing has the betaMean computed. |

**Error paths:** 405 for non-POST; 400 for invalid params or `MAINNET` (rejected before computation). `anchored_at` stays `null` on error too.

---

### Use case 2 — Replay-resistant minting (`/api/mint`)

**When to use:** you need proof that a specific verification message has not been replayed. The client generates a unique `client_nonce` (SHA-256 hex, 64 chars) and embeds it in every send.

```bash
# 1. Generate a client-side nonce once (reusable across retries is safe here)
CLIENT_NONCE=$(openssl rand -hex 32)   # 64 hex chars

# 2. POST
curl -X POST https://proofbridge-liner.vercel.app/api/mint \
  -H "Content-Type: application/json" \
  -d "{
    \"alpha\": 4, \"beta\": 4, \"gamma\": 1, \"threshold\": 0.55,
    \"deed_hash\": \"$(openssl rand -hex 32)\",
    \"client_nonce\": \"${CLIENT_NONCE}\",
    \"chain_target\": \"AMOY\",
    \"issuer_did\": \"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK\"
  }"
```

**Response (PASS):**

```json
{
  "status": "VERIFIED_SOVEREIGN_TRUTH",
  "payload": {
    "ok": true, "verdict": "PASS", "anchored_at": null,
    "pipeline_hash": "<64-hex>",
    "handshake_hash": "<64-hex>",
    "receipt_id": "<uuid>",
    ...
  },
  "signature": "hmac-sha256:<hex>"
}
```

**Response (HALT):**

```json
{ "status": "CIRCUIT_BREAKER_TRIPPED", "payload": { "verdict": "HALT", ... }, "signature": "..." }
```

**Error paths (all 400):**
- `client_nonce` missing or not 64-hex → `VALIDATION_ERROR`
- `deed_hash` not 64-hex → `VALIDATION_ERROR`
- `chain_target` not `AMOY` or `FABRIC` → `VALIDATION_ERROR` (MAINNET rejected before computation)

---

### Use case 3 — Local development

```bash
git clone https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
cd proofbridge-liner
npm install

# Local unit tests (safe to run without Vercel login)
PROOFBRIDGE_HMAC_SECRET="dev-secret" node --test test/gate1-smoke.test.js

# Local API dev server
PROOFBRIDGE_HMAC_SECRET="dev-secret" vercel dev   # http://localhost:3000
```

Set `PROOFBRIDGE_HMAC_SECRET` in the Vercel dashboard (Environment Variables → Production) before deploying to production. The `dev-secret` fallback is hard-coded in the handler; it exists to unblock local tests and should **never** be used in production — all production endpoints read `PROOFBRIDGE_HMAC_SECRET` from the Vercel environment.

---

### Use case 4 — Gate-1 Terminal UI

Visit `https://proofbridge-liner.vercel.app/gate-1` to view the full contract specification. Use the form to POST a live request and inspect the signed receipt instantly.

---

## Known Weaknesses

| Weakness | Impact | Status |
|----------|--------|--------|
| No `calibrated_threshold` in `/api/verify` response | Cannot display τ alongside μ in integrations using v1 | Documented; use `/api/mint` for full envelope |
| `anchored_at` always `null` | On-chain anchoring is design-only; receipts are self-verifiable but not chain-anchored | Next sprint |
| `calibrated_threshold` never rounded | Exposure lies at gate enforcement — the routing of assess-level guard core is not a backdoor to chain; currently returns binding raw float | Accepted; do rounding at integration layer |
| No nonce DB for `/api/verify` | Replay against GET posting is possible | Use `/api/mint` which embeds `client_nonce` in every signed field |
| `PROOFBRIDGE_HMAC_SECRET` required, not optional | If env var is unset, falls back to `dev-secret` — the response still signs, but key is predictable | Guard is present; Vercel env is configured for production |
| `MAINNET` rejected verbatim by name | No allowlist beyond `AMOY` and `FABRIC`; adding new chains requires a code change | Acceptable for current deployment scope |
| Legacy v0.9 `vvv/api/verify.js` still in repo (deprecated dir) | Old kernel compiled as CJS cannot be invoked by Gate-1 path; importing it bypasses the gate | Corp SDK does not import; migration path documented in `deprecated/vvv-api/README.md` |
| `type: module` hard-requirement at root | Any CommonJS-only dependency breaks build; current tree verified | No CJS deps in `api/` or `lib/` at time of gate-1 |
| CI step uses `curl` + `jq` without lockfile API | Rate-limited `main` pointers — `master` is reliable; Rate-limit passthrough is on `axios` passthrough | Acceptable for CI rate-bound pages only |

---

## Invariants at a Glance

On every successful POST:

```
POST /api/verify   →  { ok: true, posterior, verdict, receipt_id, pipeline_hash,
                        anchored_at: null, signature, safegrid_signal }

POST /api/mint     →  { status, payload: { ok, verdict, anchored_at: null,
                        pipeline_hash, receipt_id, ... }, signature }
```

On every rejected chain (`MAINNET`, or any string not matching `AMOY\|FABRIC`):

```
→  { ok: false, error: "VALIDATION_ERROR",
    errors: [ "... not a permitted network / MAINNET is rejected ..." ]
  }
```

No `anchored_at` field ever arrives with a truthy value. No `safefgrid_signal` (typo) field ever appears in any response.

---

## Route Map

| Route | Target | Method |
|-------|--------|--------|
| `GET /gate-1` | `/vvv/gate-1.html` | GET |
| `POST /api/verify` | `api/verify.js` (Gate-1 v1) | POST |
| `POST /api/mint` | `api/mint.js` (Gate-1 v2) | POST |
| `GET /api/health` | `api/verify.js` | GET |
| `GET /api/status` | `api/verify.js` | GET |
| `GET /api/(.*)` | `api/verify.js` (catch-all) | GET |
| `GET /*` | `vvv/index.html` | GET |

---

## Repository Structure (current)

```
proofbridge-liner/
├── api/
│   ├── verify.js              # Gate-1 v1 handler — ESM, deployed at /api/verify
│   ├── mint.js                # Gate-1 v2 handler — ESM, /api/mint, client_nonce required
│   ├── kernel.js              # ESM crypto helpers (sha256, hmacsha256 exports
│   └── package.json           # { "type": "module" }
├── deprecated/
│   └── vvv-api/
│       ├── verify.legacy.js   # v0.9 SAFE-TRIP kernel — CJS — DO NOT IMPORT
│       └── README.md          # Why it is deprecated; migration steps
├── test/
│   └── gate1-smoke.test.js    # Node 20 native runner; 2 assertions (AMOY + MAINNET)
├── vvv/
│   ├── gate-1.html            # Gate-1 terminal page — served at /gate-1
│   └── proofbridge.html       # Gate-1 Pilot badge + /gate-1 CTA
├── dashboard/
│   └── server.js              # Ops daemon — /api/status includes gate1 block
├── vercel.json                # /gate-1, /api/verify, /api/mint routes + builds
├── package.json               # { "type": "module" }  + all build scripts retained
└── .github/
    └── workflows/
        └── ci.yml             # Unit tests (node --test) + production smoke (curl)
```

---

## Live

| URL | Purpose |
|-----|---------|
| https://proofbridge-liner.vercel.app/ | VVU gateway |
| https://proofbridge-liner.vercel.app/proofbridge | ProofBridge Liner landing |
| https://proofbridge-liner.vercel.app/gate-1 | Gate-1 terminal UI |
| https://proofbridge-liner.vercel.app/api/verify | Gate-1 v1 POST endpoint |
| https://proofbridge-liner.vercel.app/api/mint | Gate-1 v2 + nonce POST endpoint |

---

## Contact

Vaguely Vanity LLC · Gqeberha, ZA  
hello@venturevisionubuntu.co.za · https://venturevisionubuntu.co.za

MIT — see `LICENSE.md`.
