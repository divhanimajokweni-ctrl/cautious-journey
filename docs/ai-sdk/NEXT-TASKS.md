# Next Tasks & Required Deliverables

**Branch:** `gate-1` (24 commits ahead of `origin/main`)  
**Generated:** 2026-05-21

---

## Blocker Status

| # | Blocker | Status | Owner |
|---|---------|--------|-------|
| B1 | Vercel Aliases — 3 active, need cleanup to exactly 1 | ❌ Open | Vercel Dashboard |
| B2 | Vercel Production Env Vars — 8 required, none set | ❌ Open | Vercel Dashboard |
| B3 | Contracts not deployed to Polygon Amoy | ❌ Open | `forge script` |
| B4 | NVIDIA NIM function calling — no model reliably populates tool args | ⚠️ Partial | Needs OpenAI/Anthropic key or NVIDIA dedicated FC endpoint |

---

## Task Queue

### P0 — Production Blockers (must resolve before `vercel --prod`)

- [ ] **B1 — Vercel Alias Cleanup** (Vercel Dashboard → Settings → Domains)
      Remove: `proofbridge-liner-divhanimajokweni-1651s-projects.vercel.app`
              `proofbridge-liner-git-main-divhanimajokweni-1651s-projects.vercel.app`
      Keep only: `proofbridge-liner.vercel.app` with 🏷️ Production badge

- [ ] **B2 — Vercel Production Env Vars** (Vercel Dashboard → Environment Variables)
      Add these 8 scoped to Production:
      | Variable | Source |
      |----------|--------|
      | `PROOFBRIDGE_HMAC_SECRET` | `openssl rand -hex 32` |
      | `ORACLE_PRIVATE_KEY` | Wallet private key |
      | `ORACLE_PUBLIC_KEY` | Wallet public address |
      | `CONTRACT_ADDRESS` | After Blocker 3 deploy |
      | `STITCH_CLIENT_ID` | Stitch Money developer portal |
      | `STITCH_CLIENT_SECRET` | Stitch Money developer portal |
      | `STITCH_SECRET` | Stitch Money webhook settings |
      | `POOLS_ENGINE_ADDRESS` | After Blocker 3 deploy |

- [ ] **B3 — Contract Deployment to Polygon Amoy**
      ```bash
      # Prerequisites
      export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
      export PRIVATE_KEY=<deployer-key>
      export POLYGONSCAN_API_KEY=<optional>

      # Verify balance (needs ~0.06 POL)
      cast balance 0x49A1ba2Bde61B96685385F4Ce012586A518c3E70 \
        --rpc-url $POLYGON_AMOY_RPC_URL

      # Build
      forge build

      # Deploy UbuntuPoolsEngine → get address → paste into POOLS_ENGINE_ADDRESS
      forge script script/DeployUbuntuPoolsEngine.s.sol \
        --rpc-url $POLYGON_AMOY_RPC_URL --broadcast

      # Deploy RiskOracleVerifier → get address → paste into CONTRACT_ADDRESS
      forge script script/DeployRiskOracleVerifier.s.sol \
        --rpc-url $POLYGON_AMOY_RPC_URL --broadcast
      ```

### P1 — AI SDK Tool Calling

- [ ] **B4 — Function-calling LLM integration**
  - Current NVIDIA NIM endpoint (`integrate.api.nvidia.com/v1`) has inconsistent function calling
  - Options:
    - **Option A**: Use OpenAI API key directly → `createOpenAI({ apiKey: process.env.OPENAI_API_KEY })` → `gpt-4o-mini` (guaranteed function calling)
    - **Option B**: Use NVIDIA's dedicated function-calling endpoint (requires separate setup)
    - **Option C**: Use `@ai-sdk/anthropic` with Anthropic API key
  - Recommendation: Option A — `@ai-sdk/openai` already installed, just add a real OpenAI key

- [ ] **Verify end-to-end tool calling**
  ```typescript
  import { executeCode } from 'ai-sdk-tool-code-execution'
  import { generateText } from 'ai'
  import { createOpenAI } from '@ai-sdk/openai'

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    tools: { executeCode: executeCode() },
    maxSteps: 5,
    prompt: 'What is the 10th Fibonacci number? Write Python to calculate it.',
  })
  // Expected: tool call with `{ code: "..." }` → sandbox execution → final answer
  ```

### P2 — Production Deploy & Verification

- [ ] **Run `scripts/replit-vercel-prod-deploy.sh`** (after B1-B3 resolved)
  ```bash
  export VERCEL_AUTH_TOKEN=...
  export EXPECTED_GIT_BRANCH=gate-1
  export EXPECTED_GIT_HEAD=4ffd7a0
  export CONFIRM_PROD_DEPLOY=yes
  npm run deploy:vercel:replit
  ```

- [ ] **Post-deploy verification** (run each route against `proofbridge-liner.vercel.app`)
  - Static: `/`, `/gate-1`, `/pools`, `/proofbridge`, `/submission`, `/whatsonboarding.html`, `/gateway` — all must return 200
  - API: `/api/v2/events`, `/api/v2/decision`, `/api/v2/payments/initiate`, `/api/v2/webhooks/stitch`, `/api/auth/nonce`, `/api/auth/verify`, `/api/auth/session`, `/api/auth/signout`, `/api/verify` — all must return 200
  - If any fails → rollback per AGENTS.md §6

### P3 — CI/CD & Automation

- [ ] **GitHub Actions — Vercel Preview Deploys**
      Auto-deploy PRs to preview environments with sandbox access

- [ ] **Stale alias monitoring**
      Script to detect stale aliases on `vercel alias ls` and alert

- [ ] **PNPM migration complete**
      Remove `package-lock.json` if no longer used (currently both exist)

---

## File Inventory

| Path | Purpose |
|------|---------|
| `scripts/replit-vercel-prod-deploy.sh` | Production deployment gate (24 checks before mutate) |
| `docs/ai-sdk/SANDBOX-SETUP.md` | AI SDK + Sandbox setup guide |
| `docs/ai-sdk/NEXT-TASKS.md` | This document — task queue & blockers |
| `.env.local` | Dev env vars (gitignored) |
| `.vercel/` | Vercel project link (gitignored) |