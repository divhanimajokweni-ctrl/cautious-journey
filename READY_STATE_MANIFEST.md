# ProofBridge Liner: Ready-State Manifest

**Last Updated:** 2026-05-20  
**Current Production Domain:** https://venturevisionubuntu.co.za  
**Current Clean Branch:** `compliance-fabric`

## Production State

- [x] Vercel production deployment is live.
- [x] Canonical domain `venturevisionubuntu.co.za` resolves to Vercel.
- [x] HTTPS returns `HTTP 200` for the public site.
- [x] `/api/health` returns `HTTP 200`.
- [x] Typo domain `venturevisualubuntu.co.za` removed from Vercel.
- [x] Git remotes sanitized to token-free URLs.
- [x] Production docs updated to remove embedded secrets.

## Verified Endpoints

```txt
https://venturevisionubuntu.co.za              HTTP 200
https://venturevisionubuntu.co.za/api/health   HTTP 200
DNS A venturevisionubuntu.co.za                76.76.21.21
```

## Vercel

- Project: `proofbridge-liner`
- Production deployment: `proofbridge-liner-qcfdfyoch-divhanimajokweni-1651s-projects.vercel.app`
- Production alias: `venturevisionubuntu.co.za`
- Domain list should include:
  - `venturevisionubuntu.co.za`
  - `ubuntupools-vvlcc.app`
  - `ubuntuvvlcc.com`

Do not recreate or use `venturevisualubuntu.co.za`.

## Replit

- Runtime: Node.js 20 module
- Workflow: `Start application`
- Command: `npm run start`
- Server: `dashboard/server.js`
- Port: `5000`
- Deployment target: `autoscale`

## Git

- Clean branch for PR: `compliance-fabric`
- Base branch: `origin/main`
- Suspicious replay branch: `gate-1` should not be pushed as the production sync branch.
- Origin remote should be token-free:

```txt
https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
```

## Compliance Fabric

- [x] `prover/compliance_tokenizer.ts` implemented.
- [x] `server/mock_sarb_endpoint.ts` implemented.
- [x] `scripts/generate_keys.mjs` implemented.
- [x] `test/verification_loop.test.ts` implemented.
- [x] Strict TypeScript config added.
- [x] Generated `dist/` and PEM key files ignored.

Verification command:

```bash
npm test
```

Expected final status:

```txt
COMPLETE
```

## Security Posture

- No private keys should appear in committed docs or env examples.
- No GitHub, Hugging Face, Vercel, wallet, or RPC tokens should appear in `.git/config`.
- Rotate any credential that previously appeared in local config or documentation.
- Keep generated RSA PEM files local only.

## Current Status

**Ready for PR from `compliance-fabric` after final `npm test` and Git push.**
