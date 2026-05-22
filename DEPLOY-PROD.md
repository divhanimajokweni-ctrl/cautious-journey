# ProofBridge Liner — Production Deployment Guide

> **Single source of truth for everything that must happen before, during, and after `vercel --prod`.**  
> Work from top to bottom. Do not skip a section.

---

## Table of Contents

1. [What's Already Done](#1-whats-already-done)
2. [What's Blocking Production Right Now](#2-whats-blocking-production-right-now)
3. [Prerequisites](#3-prerequisites)
4. [Step-by-Step: Resolve Blockers](#4-step-by-step-resolve-blockers)
5. [Branch, Push, and Deploy](#5-branch-push-and-deploy)
6. [Post-Deploy Verification Table](#6-post-deploy-verification-table)
7. [Execution Loop](#7-execution-loop)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Current Branch State](#9-current-branch-state)
10. [Glossary](#10-glossary)

---

## 1. What's Already Done

All of the following shipped to `origin/gate-1` (latest commit `2b20bb0`, 22 commits ahead of `origin/main` at `0efd3188`):

### Code

| Layer | Status | Notes |
|-------|--------|-------|
| API v2 — `POST /api/v2/events` | ✅ Code | Bayesian α/β update |
| API v2 — `POST /api/v2/decision` | ✅ Code | EIP-712 oracle verdict + `hmac-sha256` signature |
| API v2 — `POST /api/v2/payments/initiate` | ✅ Code | Stitch Instant EFT execution for `RISK_VERIFIED` proposals |
| API v2 — `POST /api/v2/webhooks/stitch` | ✅ Code | `X-Stitch-Signature` HMAC verify; closes risk-engine loop |
| Auth — `GET /api/auth/nonce` | ✅ Code | SIWE challenge |
| Auth — `POST /api/auth/verify` | ✅ Code | Wallet sig → `hmac-sha256` JWT session |
| Auth — `GET /api/auth/session` | ✅ Code | Bearer token validation |
| Auth — `POST /api/auth/signout` | ✅ Code | Session discard |
| Auth — `lib/jwt.js` | ✅ Code | HMAC-SHA256 JWT signer (symlink → `api/auth/jwt.js`) |
| Inline HTML scripts (gate-1) | ✅ `node --check` PASS | verify-form client |
| Inline HTML scripts (whatsonboarding) | ✅ `node --check` PASS | kasi/church/general tone-simulator |

### Config

| Item | Status | Notes |
|------|--------|-------|
| `vercel.json` | ✅ `functions` (was `builds`) | 14 per-handler entries, `maxDuration` per endpoint |
| `vvv/vercel.json` | ✅ Minimal stub | `version+name` only — intentionally diverges from root |
| `AGENTS.md` | ✅ v2 gates populated | §1 branch, §2 code-review, §3 alias gate, §4 env, §5 post-deploy table, §7 pre-push checklist |
| `README.md` | ✅ v2 architecture + routes | All env vars, deployment steps, state machine, `deploy/` system |
| `DEPLOYMENT.md` | ✅ Present | Contract deployment + wallet funding steps + blocked-key guardrails |
| `DEPLOY-PROD.md` | ✅ Present | This file — the runbook itself |
| `deploy/` | ✅ Present | `full_auto_deploy.sh`, `config.sh`, `utils.sh`, `notify.sh`, `extract_addresses.sh`, `rollback.sh` |
| `.github/workflows/prod.yml` | ✅ Present | CI/CD: pre-flight (syntax + key gate) → deploy → Slack failure alert |
| `db/schema.sql` | ✅ Ready | entities / proposals / decisions / events + FK + triggers for webhook persistence |
| `services/` layer | ✅ Present | signer, state (file-backed KV), gateway, orchestrator, jwt |
| `contracts/` | ✅ Present | `RiskOracleVerifier.sol`, `UbuntuPoolsEngine.sol` |
| `.env.example` | ✅ Present | All required env vars + ⛔ BLOCKED KEY warning on `...f017fed6` |

### Git key purge — 2026-05-22

| Item | Status |
|------|--------|
| Leaked key variants found in history | `...f017fed6` / `...f02` in `DEPLOY-PROD.md`, `DEPLOYMENT.md` |
| `git filter-repo --replace-text` | ✅ Purged — 212 commits rewritten, key replaced with `REMOVED_SECRET` |
| `git grep` on entire rewritten history | ✅ No leaked key found |
| `origin` re-added after filter-repo | ✅ Yes |
| `.env`, `.env.local`, `.env.production` | ✅ Clean — key not present in any env file |
| Remaining trace | ⚠️ Intentional `.env.example:2` warning comment only |

---

## 2. What's Blocking Production Right Now

Three blockers — none of them fixable by CLI alone. Each one requires **manual action**.

> ⛔ **Key rotation required**: The old deployer key ending in `...f017fed6` was purged from git history on **2026-05-22** via `git filter-repo`. All history was rewritten (212 commits). A new keypair on a fresh funded wallet must replace it in Vercel Secrets before any `vercel --prod`.

```
┌ BLOCKER 1 ── Vercel Aliases: consolidate to exactly 1 Production ──────────────┐
│                                                                                  │
│ npx vercel ls → must show exactly 1 alias with "Production" scope                │
│                                                                                  │
│ FIX: Vercel dashboard → Team Settings → Domains → unlink all stale aliases,      │
│      keeping only proofbridge-liner.vercel.app as Production.                     │
│                                                                                  │
│ CONFIRM: npx vercel ls → single line with "Production"                           │

┌ BLOCKER 2 ── Vercel Environment Variables ────────────────────────────────────┐
│                                                                                  │
│ Required — Vercel Dashboard → [Project] → Settings → Environment Variables →   Production:
│                                                                                  │
│  Variable               Why                                    Required          │
│  ─────────────────────  ──────────────────────────────────────  ───────          │
│  DEPLOYER_PRIVATE_KEY   Forge broadcast signing key (new pair) YES               │
│  ORACLE_PRIVATE_KEY     EIP-712 signing (v2/decision)           YES               │
│  ORACLE_PUBLIC_KEY      EIP-712 verifying contract address      YES               │
│  PROOFBRIDGE_HMAC_SECRET HMAC-SHA256 response/JWT signing       YES               │
│  POLYGON_AMOY_RPC_URL   Amoy RPC endpoint                       YES               │
│  POLYGONSCAN_API_KEY    Etherscan verification                  YES               │
│  STITCH_CLIENT_ID       Stitch OAuth2 client ID                  YES               │
│  STITCH_CLIENT_SECRET   Stitch OAuth2 client secret              YES               │
│  STITCH_SECRET          Svix/Stitch webhook HMAC                 YES               │
│  POOLS_ENGINE_ADDRESS   UbuntuPoolsEngine on Amoy (empty 1st)   YES               │
│  CONTRACT_ADDRESS       RiskOracleVerifier on Amoy               YES               │
│                                                                                  │
│ FIX: Vercel dashboard → Set each variable scoped to Environment = Production.   │
│      Do NOT commit any of these to git. .env.example has zero real credentials.  │
│                                                                                  │
│ CONFIRM: npx vercel ls after first prod deploy → logs must show real SECRETs.   │

┌ BLOCKER 3 ── UbuntuPoolsEngine + RiskOracleVerifier Not on Amoy ────────────────┐
│                                                                                  │
│ The pools engine and oracle verifier are in source but have not been broadcast.  │
│                                                                                  │
│ FIX via full_auto_deploy.sh (recommended):                                       │
│   export NETWORK=amoy                                                            │
│   export DEPLOYER_PRIVATE_KEY=0x<new-rotated-key>                                │
│   bash deploy/full_auto_deploy.sh                                                │
│                                                                                  │
│ Or manually:                                                                      │
│   export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/               │
│   # ⛔ BLOCKED KEY 0xb259...fed6 — do NOT reuse                                 │
│   export DEPLOYER_PRIVATE_KEY=0x<new-rotated-key>                                │
│   forge script script/DeployUbuntuPoolsEngine.s.sol \                            │
│     --rpc-url $POLYGON_AMOY_RPC_URL --broadcast                                  │
│   forge script script/DeployRiskOracleVerifier.s.sol \                           │
│     --rpc-url $POLYGON_AMOY_RPC_URL --broadcast                                  │
│                                                                                  │
│ After each deploy, paste the address from console output into the corresponding │
│ Vercel env var (POOLS_ENGINE_ADDRESS / ORACLE_PUBLIC_KEY / CONTRACT_ADDRESS).    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Do not run `vercel --prod` until all three blockers are resolved.**

---

## 3. Prerequisites

### Tools installed

| Tool | Why | Check |
|------|-----|-------|
| Node.js ≥ 20 | `crypto` built-ins, `node --test`, `node --check` | `node --version` |
| Foundry (forge) | Contract compilation + Amoy deploy | `forge --version` |
| Vercel CLI 54+ | Production deploy | `npx vercel --version` |
| GitHub CLI (`gh`) | Auth status | `gh auth status` |
| GitHub account `divhanimajokweni-ctrl` | Authenticated on Vercel + GitHub | `gh auth status` |

### Wallet funded for contract deploys

| Item | Value |
|------|-------|
| Deployer address | `0x49A1ba2Bde61B96685385F4Ce012586A518c3E70` |
| Required balance | ~0.06 POL (contracts + gas) |
| Faucet | https://faucet.polygon.technology/ (Amoy testnet) |

### Environment variables (Vercel Dashboard → Production)

| Variable | Required | Used By |
|----------|----------|---------|
| `PROOFBRIDGE_HMAC_SECRET` | Yes | All API handlers — response signing |
| `ORACLE_PRIVATE_KEY` | Yes | `v2/decision` — EIP-712 signing |
| `ORACLE_PUBLIC_KEY` | Yes | `v2/decision` — EIP-712 verifying contract |
| `CONTRACT_ADDRESS` | Yes | `v2/decision` — RiskOracleVerifier on Amoy |
| `STITCH_CLIENT_ID` | Yes | `v2/payments` — OAuth2 client ID |
| `STITCH_CLIENT_SECRET` | Yes | `v2/payments` — OAuth2 client secret |
| `STITCH_SECRET` | Yes | `v2/webhooks/stitch` — HMAC webhook verify |
| `POOLS_ENGINE_ADDRESS` | Yes | UbuntuPoolsEngine Amoy address |

> **Do not deploy with real env copy-pasted. `.env` is `.gitignore`-ed. Paste only into Vercel dashboard UI.**

---

## 4. Step-by-Step: Resolve Blockers

### 4.A — Vercel Alias Cleanup (Blocker 1)

**Goal:** Exactly 1 Production alias → `proofbridge-liner.vercel.app`

```bash
# Confirm current state
npx vercel ls

# Open Vercel dashboard (browser)
#   1. Team: divhanimajokweni-1651s-projects
#   2. Project: proofbridge-liner
#   3. Left sidebar → Settings → Domains
#   4. Stale domains to remove (any Production domain NOT proofbridge-liner.vercel.app):
#      proofbridge-liner-divhanimajokweni-1651s-projects.vercel.app
#      proofbridge-liner-git-main-divhanimajokweni-1651s-projects.vercel.app
#      ...and any other domain listed with the 🏷️ Production badge
#   5. Click "Remove" or Unlink for each stale domain
#   6. Click "Add Domain" → enter "proofbridge-liner.vercel.app" → confirm
#   7. Ensure ONLY proofbridge-liner.vercel.app shows a Production badge

# Re-verify from CLI
npx vercel ls
# Expected: exactly 1 line with "Production"
```

---

### 4.B — Vercel Environment Variables (Blocker 2)

**Goal:** All 8 env vars set in Vercel Dashboard → Production scope

```bash
# Open Vercel dashboard (browser)
#   Team: divhanimajokweni-1651s-projects
#   Project: proofbridge-liner
#   Settings → Environment Variables
#
# For each variable below:
#   1. Click "Add New"
#   2. Key: <VAR_NAME>
#   3. Value: paste from 1Password / secrets manager (not shell history)
#   4. Environment: ✅ Production ✅ Preview ✅ Development (all three)
#   5. Save
#
# Required variables:
#
#   PROOFBRIDGE_HMAC_SECRET
#     → Generate: openssl rand -hex 32
#     → Paste into Vercel dashboard
#     → DO NOT commit to .env unless .env.example references it
#
#   ORACLE_PRIVATE_KEY
#     → Ethereum private key for EIP-712 signing
#     → Keep offline / secrets manager only
#
#   ORACLE_PUBLIC_KEY
#     → Ethereum address of the verifying contract (oracle)
#
#   CONTRACT_ADDRESS
#     → Address of RiskOracleVerifier on Polygon Amoy
#     → Not known yet — fill after contract deploy (Blocker 3)
#
#   STITCH_CLIENT_ID
#     → From Stitch Money developer portal
#
#   STITCH_CLIENT_SECRET
#     → From Stitch Money developer portal
#
#   STITCH_SECRET
#     → HMAC webhook secret from Stitch
#
#   POOLS_ENGINE_ADDRESS
#     → Address of UbuntuPoolsEngine on Polygon Amoy
#     → Not known yet — fill after contract deploy (Blocker 3)
#
# CONFIRM: After adding, re-open env vars page and verify each key is present
```

---

### 4.C — Deploy Contracts to Polygon Amoy (Blocker 3)

**Goal:** `UbuntuPoolsEngine` and `RiskOracleVerifier` live on Amoy with real addresses

```bash
# Set RPC and private key (testnet, 0.06 POL needed)
export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
# ⛔ BLOCKED KEY 0xb259...fed6 — purged from history, do NOT reuse. Use a fresh keypair.
export PRIVATE_KEY=<new-rotated-key>

# Verify balance first
cast balance 0x49A1ba2Bde61B96685385F4Ce012586A518c3E70 --rpc-url $POLYGON_AMOY_RPC_URL
# Must be ≥ 0.05 POL (≈ 300,000,000,000,000,000 wei / 0.05e18)

# Step 1 — Build all contracts
forge build
# Must show "Compiler run successful" with 0 errors

# Step 2 — Deploy UbuntuPoolsEngine
forge script script/DeployUbuntuPoolsEngine.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Console output will contain:
#   UbuntuPoolsEngine deployed at: 0x...
# Copy this address → paste into Vercel env var POOLS_ENGINE_ADDRESS
# Wait for Etherscan verification (1–2 minutes)

# Step 3 — Deploy RiskOracleVerifier
forge script script/DeployRiskOracleVerifier.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Console output will contain:
#   RiskOracleVerifier deployed at: 0x...
# Copy this address → paste into Vercel env var CONTRACT_ADDRESS
# Also copy the oracle address → paste into Vercel env var ORACLE_PUBLIC_KEY
# Wait for Etherscan verification (1–2 minutes)
```

---

## 5. Branch, Push, and Deploy

```bash
# ─── 5.A — Confirm branch state ────────────────────────────────────────────
git branch --show-current        # must be "gate-1"
git status -sb                    # clean working tree
git rev-parse HEAD                # run as $CURRENT_SHA
git log --oneline -4              # latest: 3faae30, ee0a86f, 65b3d64, e3131c5

# ─── 5.B — Push any local fixes ────────────────────────────────────────────
# If you made any changes since last push:
git add -A
git status --short                # confirm only intended changes appear
git commit -m "chore: <describe change>"
git push origin gate-1

# ─── 5.C — Pre-deploy gate checks ──────────────────────────────────────────
# Run every check listed in AGENTS.md §1 and §2 BEFORE running vercel --prod.
# All must pass.

# (Paste the full §1 + §2 table from AGENTS.md here and check off each row)

# ─── 5.D — Vercel Production Deploy ────────────────────────────────────────
npx vercel --confirm --prod
```

---

## 6. Post-Deploy Verification Table

Run **immediately** after `vercel --prod` succeeds. All routes must return `200` with correct content.

```bash
# ── Static routes ───────────────────────────────────────────────────────────

curl -sI  https://proofbridge-liner.vercel.app/ | grep -i etag
curl -sf  https://proofbridge-liner.vercel.app/ | head -c 200
# Must contain: <title>VVU Ant-Kernel</title> or "ProofBridge"

curl -sf  https://proofbridge-liner.vercel.app/gate-1 | grep -c SafeBridge
# Must return 1 or more

curl -sf  https://proofbridge-liner.vercel.app/pools | grep -c Ubuntu
# Must return 1 or more

curl -sf  https://proofbridge-liner.vercel.app/proofbridge | grep -c ProofBridge
# Must return 1 or more

curl -sf  https://proofbridge-liner.vercel.app/submission | grep -ci submission
# Must return 1 or more

curl -sfI https://proofbridge-liner.vercel.app/whatsonboarding.html | head -1
# Must return HTTP 200

curl -sfI https://proofbridge-liner.vercel.app/gateway | head -1
# Must return HTTP 200 (alias → gate-1.html)

# ── API v2 POST routes ──────────────────────────────────────────────────────

curl -sfX POST https://proofbridge-liner.vercel.app/api/v2/events \
  -H 'Content-Type: application/json' \
  -d '{"entity_id":"stokvel_123","direction":"POSITIVE","weight":3}'
# Expected: {"ok":true,"event_id":...,"alpha":...,"beta":...,"posterior":...}

curl -sfX POST https://proofbridge-liner.vercel.app/api/v2/decision \
  -H 'Content-Type: application/json' \
  -d '{"entity_id":"stokvel_123"}'
# Expected: {"ok":true,"belief":...,"threshold":...,"verdict":"PASS|WARN|HALT",
#            "signature":"0x...","nonce":...,"decision_id":"..."}

curl -sfX POST https://proofbridge-liner.vercel.app/api/v2/payments/initiate \
  -H 'Content-Type: application/json' \
  -d '{"proposal_id":"8d1c4532-0000-0000-0000-000000000000"}' \
  -w "\nHTTP status: %{http_code}\n"
# Expected 202: {"ok":true,"proposal_id":"...","status":"EXECUTION_PENDING","transaction_id":"..."}

# ── Webhook (HMAC-gated — must include valid signature) ─────────────────────
# If HMAC is set, 202; if dev secret, may still 202 with fallback check
curl -sfX POST https://proofbridge-liner.vercel.app/api/v2/webhooks/stitch \
  -H 'Content-Type: application/json' \
  -H "X-Stitch-Signature: sha256=$(echo -n 'test' | openssl dgst -sha256 -hmac dev-secret | sed 's/^.* //')" \
  -d '{"event_type":"payment.settled","transaction_id":"test-001",...}'

# ── Auth routes ─────────────────────────────────────────────────────────────

curl -sf  https://proofbridge-liner.vercel.app/api/auth/nonce
# Expected: {"nonce":"...","expires_in":300}

NONCE=$(curl -sf https://proofbridge-liner.vercel.app/api/auth/nonce | python3 -c 'import sys,json; print(json.load(sys.stdin)["nonce"])')
curl -sfX POST https://proofbridge-liner.vercel.app/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"nonce\":\"$NONCE\",\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f8cDeC\",\"signature\":\"0xabc\"}"
# Expected: {"ok":true,"session":{"token":"...","address":"...","expires_in":86400}}
# (signature will fail without real wallet — nonce issuance is the critical check)

curl -sf  -H 'Authorization: Bearer <paste token from verify call>' \
  https://proofbridge-liner.vercel.app/api/auth/session
# Expected: {"ok":true,"session":{...}}

curl -sfX POST https://proofbridge-liner.vercel.app/api/auth/signout \
  -H 'Content-Type: application/json' \
  -d '{}'
# Expected: HTTP 204 No Content

# ── V1 routes (must keep 200) ───────────────────────────────────────────────

curl -sfX POST https://proofbridge-liner.vercel.app/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"alpha":2,"beta":1,"gamma":1.2,"threshold":0.95,
        "deed_hash":"a3f1c2d3e4f5a6b7c8d9e0f102030405060708090a1b2c3d4e5f6a7b8c9d0e1f",
        "issuer_did":"did:key:z6MkFakeHashgBZDvotDkL5257...","chain_target":"AMOY"}'
# Expected: {"ok":true,"posterior":...,"verdict":"PASS|WARN|HALT",
#            "receipt_id":"...","anchored_at":null,"signature":"0x...",
#            "safegrid_signal":...}
```

### Deploy Verification Summary Table

Fill in after running all checks:

```
/               → HTTP ___ [✓ PASS | ✗ FAIL]
/gate-1         → HTTP ___ [✓ PASS | ✗ FAIL]
/pools          → HTTP ___ [✓ PASS | ✗ FAIL]
/proofbridge    → HTTP ___ [✓ PASS | ✗ FAIL]
/submission     → HTTP ___ [✓ PASS | ✗ FAIL]
/whatsonboarding.html   → HTTP ___ [✓ PASS | ✗ FAIL]
/gateway        → HTTP ___ [✓ PASS | ✗ FAIL]
/api/v2/events  → HTTP ___ [✓ PASS | ✗ FAIL]
/api/v2/decision→ HTTP ___ [✓ PASS | ✗ FAIL]
/api/v2/payments/initiate → HTTP ___ [✓ PASS | ✗ FAIL]
/api/v2/webhooks/stitch   → HTTP ___ [✓ PASS | ✗ FAIL]
/api/auth/nonce  → HTTP ___ [✓ PASS | ✗ FAIL]
/api/auth/verify → HTTP ___ [✓ PASS | ✗ FAIL]
/api/auth/session→ HTTP ___ [✓ PASS | ✗ FAIL]
/api/auth/signout→ HTTP ___ [✓ PASS | ✗ FAIL]
/api/verify      → HTTP ___ [✓ PASS | ✗ FAIL]
```

**If any route is not 200 → stop, do not run a second `vercel --prod`, and follow the rollback procedure below.**

---

## 7. Execution Loop

Once production is confirmed healthy, run the execution loop to process `RISK_VERIFIED` proposals through Stitch.

```bash
# ── Dry-run (logs only, no API calls) ─────────────────────────────────────
node -e "import { runExecutionLoop } from './services/execution/orchestrator.js'; console.log(await runExecutionLoop(10));"

# ── Live run (processes Stitch payments for RISK_VERIFIED proposals) ─────────
node -e "import { runExecutionLoop } from './services/execution/orchestrator.js'; console.log(await runExecutionLoop(null, { live: true }));"

# ── Recurring (every 60 s) via nohup ───────────────────────────────────────
nohup bash -c 'while true; do node -e "import { runExecutionLoop } from ./services/execution/orchestrator.js; console.log(new Date().toISOString(), await runExecutionLoop(null, { live: true }))"; sleep 60; done' > .local/state/exec.log 2>&1 &
disown
```

The execution loop state machine:

```
RISK_VERIFIED
     │
     ▼ (orchestrator calls Stitch stitchAdapter.instantEft)
     │
EXECUTION_PENDING   ←--- settlement will promote to SETTLED
     │
     ▼ (webhook /api/v2/webhooks/stitch confirms payment)
     │
SETTLED
```

---

## 8. Rollback Procedure

**Do not run a second `vercel --prod` on top of a bad state.**

```bash
# ── 1. Identify the last known-good production deploy ───────────────────────
npx vercel ls | grep Production | head -5

# ── 2. Compare what broke it ────────────────────────────────────────────────
# Let $GOOD_SHA be the commit that was in the last good production deploy
# (find it via GitHub → commits → Production deploy timestamp)
git log --oneline $GOOD_SHA..HEAD          # shows what broke it
git log --oneline HEAD..$GOOD_SHA          # shows what was live in good state

# ── 3. Tag the good deploy ─────────────────────────────────────────────────
git tag -a prod-known-good -m "safe state <paste-sha-from-step-2>"

# ── 4a. Fast-forward main back ──────────────────────────────────────────────
git checkout main
git merge --ff-only $GOOD_SHA
git push origin main

# ── 4b. OR redeploy the known-good commit ───────────────────────────────────
git checkout prod-known-good
npx vercel --confirm --prod
git checkout gate-1

# ── 5. Re-run post-deploy verification ─────────────────────────────────────
# Re-run the full table from §6.
```

---

## 9. Current Branch State

```bash
# Current branch
git branch --show-current          # → gate-1

# Latest commit
git rev-parse HEAD                 # → 571b24f
git log --oneline -5
# 571b24f fix(gate-1): runtime integrity fixes + production deploy system
# e3a9892 feat: add webhook persistence tables to db/schema.sql
# 810eb6a feat: add persistence layer to Stitch webhook handling
# d01a0d7 fix: pin openzeppelin-contracts-upgradeable to v4.9.6
# aae3495 feat(scripts+docs): add Vercel env import script + Command Code API provider

# Working tree status
git status -sb
# ## gate-1
#  M .env.example, DEPLOY-PROD.md, DEPLOYMENT.md, api/auth/verify.js
# ?? .github/workflows/prod.yml, deploy/, api/auth/oauth/, lib/jwt.js
```

### Branch State Summary

| Branch | Date | Ahead of main | Push status |
|--------|------|---------------|-------------|
| `gate-1` | latest | 29 commits | Force-pushed 2026-05-22 (purge + deploy system) |
| `main` | oldest | 0 (base) | Force-pushed 2026-05-22 (head synced to last known good) |

> ⛔ **History note**: All branches were force-pushed on 2026-05-22 after `git filter-repo` purged
> the exposed deployer key (`0xb259...f017fed6`), rewriting 212 commits.
> Collaborators must reclone or `git fetch --all && git reset --hard origin/gate-1`.

### Branching Strategy

- **`gate-1`** is the long-running integration branch.
- `main` is the stable branch — merge `gate-1` → `main` when v1 + v2 are both production-ready.
- All deploy gating is in `AGENTS.md §7` (pre-push checklist) and `.github/workflows/prod.yml` (CI/CD).

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **Bayesian engine** | α/β update loop inside `api/v2/events.js`; feeds entity belief state |
| **Blocker** | A mandatory production prerequisite that is not yet satisfied |
| **EIP-712** | Ethereum typed-data signing standard; used for oracle decision signatures |
| **FSCA** | Financial Sector Conduct Authority (ZA); ProofBridge compliance target |
| **HMAC-SHA256** | Response signing on every API handler; `PROOFBRIDGE_HMAC_SECRET` |
| **POL** | Polygon native token; ~0.06 POL needed for Amoy contract deploys |
| **PoS** | Polygon (Proof-of-Stake) testnet |
| **Prod gateway** | `proofbridge-liner.vercel.app` — canonical Production alias |
| **RISK_VERIFIED** | Proposal status after oracle decision → enters execution pipeline |
| **SETTLED** | Terminal proposal status; webhook confirmed payment |
| **Tōken** | The `.local/state/db.json` file-backed KV store; no SQL required |
| **UbuntuPoolsEngine** | Committee-governed stokvelSol contract; 3-of-5 TSS quorum |
| **Větuonymous Ussd** | File-backed JSON (not SQL); Vercel/serverless compatible |
| **Verview** | New fast, strict bundler/initiator integration used by Vult |

---

*ProofBridge Liner v2 · Vaguely Vanity LLC, Gqeberha, ZA · MIT License · 2026*
