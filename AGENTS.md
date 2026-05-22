# CI/CD Deploy Guard — ProofBridge Liner / VVU

**Rule: enforced before any push to `production`, any `--prod` deploy, before any
alias or domain change, before any Vercel / cloud-target mutation.**

Any agent or CI runner that reaches the "push / deploy" step MUST first open and
check off every item below. If any item fails, the agent must stop, surface the
exact diagnosis, and wait for a human decision.

---

## 1 · Branch & Git State

| gate | check |
|------|-------|
| Which branch is the current HEAD on? | `git branch --show-current` |
| Is that branch tracking the intended remote? | `git status -sb` |
| Is the branch ahead of `origin/main`? If yes — why? | `git rev-parse HEAD`, `git rev-parse origin/main`, diff log |
| Have any uncommitted changes been accidentally staged? | `git diff --cached --stat`, `git status` |
| Are secrets in the commit diff? | `git diff | grep -iE 'key|secret|token|password|pass_|_SECRET'` |
| Is the HEAD SHA already deployed? | `curl -sI https://proofbridge-liner.vercel.app/\| grep etag` vs `git rev-parse HEAD` |

---

## 2 · Code-Level Review (pre-deploy)

Run these checks **locally** before any `git push` or `vercel --prod`:

| gate | command |
|------|---------|
| JS syntax in all script blocks of HTML files | extract each `<script>` block → save to temp `.js` → `node --check <file>` |
| Route conflicts in `vercel.json` | `grep '"src"' vercel.json` — ensure no two `src` patterns shadow each other |
| Build config not stale across duplicate copies | `diff vercel.json vvv/vercel.json` — review every discrepancy; `vvv/vercel.json` is a minimal stub (`version+name` only) not independently deployed, so differences are expected and intentional; `builds` has been replaced by `functions` in root config per Vercel `vercel.json` best practice |
| Any hard-coded secrets, e-mail addresses, or private keys | `git grep -iE '0x[0-9a-fA-F]{40}|-----BEGIN|sk_live|pk_live|ghp_|sk-'` |
| No debug comments or console.log in production code | `git grep -inE 'console\.(log|warn|error)|debugger|TODO|FIXME|HACK'` |

---

## 3 · Vercel Deployment Domain & Alias

BEFORE running `vercel --prod`:

```bash
# 3a — Which Vercel team / project does cwd resolve to?
cat .vercel/project.json

# 3b — List current production and preview aliases
npx vercel ls

# 3c — What deployment is the canonical alias currently pointing to?
npx vercel inspect proofbridge-liner.vercel.app

# 3d — What does the canonical alias actually serve right now?
curl -sL https://proofbridge-liner.vercel.app/ | head -c 300
```

| gate | accept / reject |
|------|-----------------|
| Is there **exactly one** `production` alias pointing to `proofbridge-liner.vercel.app`? | reject if zero or multiple |
| Is the deployed content the expected VVU homepage (`vvv/index.html`)? | compare first 200 bytes or SHA256 |
| Is `gate-1`, `gateway`, `pools`, `proofbridge`, `submission`, `whatsonboarding.html` all 200? | reject any 4xx / 5xx |
| Does the new deploy have the new changes in scope? | `git diff HEAD~1 HEAD --stat` matches `git add` list |

---

## 4 · Environment Checks (pre-push & pre-deploy)

```bash
# 4a — All required environment variables set?
env | grep -iE 'PROOFBRIDGE_HMAC_SECRET|STITCH|VERCEL|NODE_ENV'

# 4b — Vercel token available?
gh auth status   # must show logged-in divhanimajokweni-ctrl

# 4c — Vercel CLI reachable?
npx vercel --version
```

If `PROOFBRIDGE_HMAC_SECRET` is _not_ set, the dev fallback (`dev-secret`) will be used
silently — reject any deploy that cannot confirm the real env var is in Vercel
dashboard → Environment Variables → Production.

---

## 5 · Post-Deploy Verification (mandatory after every Vercel `--prod`)

Verify each of the following URLs returns `200` with correct content:

| route | what to look for |
|-------|-----------------|
| `/` | `<title>VVU Ant-Kernel</title>` and `vvv/index.html` hash match |
| `/gate-1` | Gate-1 terminal `<title>SafeBridge` or `Gate-1` |
| `/pools` | `Ubuntu Pools`, `Stokvel`, `Umuntu` |
| `/whatsonboarding.html` | `<title>VVU WhatsApp Onboarding</title>` |
| `/proofbridge` | `ProofBridge Liner`, `FSCA`, `Amoy` |
| `/dashboard` | `VVU`, `Secure Console`, `Secure` |
| `POST /api/v2/events` | `202` — event ingested, entity stats returned |
| `POST /api/v2/decision` | `{ok:true, belief, threshold, verdict, signature}` |
| `POST /api/v2/payments/initiate` | `{ok:true, proposal_id, status:EXECUTION_PENDING}` |
| `POST /api/v2/webhooks/stitch` | `{ok:true, processed}` (HMAC-gated) |
| `GET /api/auth/nonce` | `{nonce}` — 200, no auth required |
| `POST /api/auth/verify` | `{ok:true, session:{token}}` — valid sig returns JWT |
| `GET /api/auth/session` | `{ok:true, session}` with Bearer token |
| `/submission` | `<title>` present and not 404 |
| `POST /api/verify` | `{"ok":true,"verdict":"PASS|WARN|HALT"}` |
| `GET /api/health` | `{"error":"method_not_allowed","allowed":["POST"]}` |

Print a summary table:

```
/   → 200  ✓
/gate-1 → 200  ✓
/pools → 200  ✓
...
```

If any route is not 200 → stop, roll back, alert.

---

## 6 · Rollback Procedure

**If the post-deploy check fails on production:**

1. Do **not** run a second `vercel --prod` on top of a bad state.
2. Identify the previous working deployment SHA via `vercel ls`.
3. Check the branch state of this SHA:
   ```
   git log --oneline <known-good-sha>..HEAD   # shows what broke it
   git log --oneline HEAD..<known-good-sha>   # shows what was live
   ```
4. Add a git tag on the good deploy: `git tag -a prod-known-good -m "safe state <sha>"`
5. Either:
   a. **Fast-forward `main` back** to the good commit and push:  
      `git checkout main && git merge --ff-only <good-sha> && git push origin main`  
   b. **Re-deploy the known-good** by checking it out locally and running `vercel --prod` from that tree.
6. Re-run the post-deploy table before closing.

---

## 7 · Pre-Push Checklist (agents only — summary)

```
[ ] Branch is correct (main / gate-1 / feature-branch)
[ ] No uncommitted secrets or PII in diff
[ ] vvv/vercel.json vs root/vercel.json diff reviewed and intentional
[ ] No route collisions dressed as "static" in vercel.json builds
[ ] vercel ls aliases filtered — production target confirmed
[ ] vercel inspect shows correct alias│san alignment
[ ] vercel --confirm --prod run NOT already failed (no double-tap)
[ ] All production routes OK after deploy (/, /gate-1, /gateway, /pools, /proofbridge, /submission, /whatsonboarding.html, /api/v2/events, /api/v2/decision, /api/auth/nonce)
[ ] Post-deploy hash matches `vvv/index.html` canonical SHA256
[ ] gate-1 branch is tracked and reviewed before merge to main (currently 29 commits ahead of origin/main — see DEPLOYMENT.md branching strategy)
[ ] `.github/workflows/prod.yml` pre-flight key-leak gate passes (`git log -S 'b25939...'`)
[ ] `deploy/full_auto_deploy.sh` PRIVATE_KEY and ORACLE_PRIVATE_KEY do not match the `^0xb259` blocked-key pattern
```

---

> **This file is the single source of truth for production deployment safety.
> If it is missing from the workspace root, every push and every deploy is
> gated by human sign-off until this file is restored.**
>
> â€” ProofBridge Liner · Vaguely Vanity LLC · Gqeberha, ZA · May 2026
