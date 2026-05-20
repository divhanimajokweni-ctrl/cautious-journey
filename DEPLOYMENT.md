# Deployment Guide

This document reflects the current production operating state for ProofBridge Liner / Venture Vision Ubuntu.

## Current Production

- Canonical domain: https://venturevisionubuntu.co.za
- Vercel production deployment: `proofbridge-liner-qcfdfyoch-divhanimajokweni-1651s-projects.vercel.app`
- Vercel alias: `venturevisionubuntu.co.za`
- DNS apex target: `76.76.21.21`
- Health route: https://venturevisionubuntu.co.za/api/health

Do not use `venturevisualubuntu.co.za`; that typo domain was removed from Vercel.

## Production Deploy

Deploy from a clean branch/worktree, currently `compliance-fabric` for the compliance fabric PR.

```bash
npm install
npm test
vercel deploy --prod --yes
```

If the production alias does not move automatically, set it explicitly:

```bash
vercel alias set <deployment-url> venturevisionubuntu.co.za
```

Verify:

```bash
curl -I https://venturevisionubuntu.co.za
curl -I https://venturevisionubuntu.co.za/api/health
```

Expected: `HTTP/1.1 200 OK`.

## DNS

The active domain is delegated through third-party nameservers:

```txt
ns1.host-ww.net
ns2.host-ww.net
```

Required apex record for Vercel:

```txt
Type: A
Name: @
Value: 76.76.21.21
TTL: 300 or provider default
```

Recommended `www` record:

```txt
Type: CNAME
Name: www
Value: cname.vercel-dns.com.
TTL: 300 or provider default
```

The repository zone file at `vvv/dns/zone.corrected.bind` should remain aligned to `venturevisionubuntu.co.za`.

## Vercel Routes

Route behavior is defined in `vercel.json`.

Important routes:

```txt
/                 -> /vvv/index.html
/gate-1           -> /vvv/gate-1.html
/pools/*          -> Ubuntu Pools static journey pages
/admin/pools      -> /vvv/admin-pools.html
/api/health       -> /api/verify.js
/api/status       -> /api/verify.js
/api/verify       -> /api/verify.js
/api/mint         -> /api/mint.js
```

## Replit Runtime

Replit is configured for the Express dashboard/runtime:

```txt
Node module: nodejs-20
Workflow: Start application
Command: npm run start
Deployment target: autoscale
Run command: node dashboard/server.js
Port: 5000
```

## Compliance Fabric Verification

The TypeScript compliance fabric is build/test verified with Node.js 22 LTS:

```bash
npm run build
npm test
```

The test suite validates:

```txt
1. isolated memory bounds and syntax parse
2. asymmetric JWT cryptographic verification
3. SARB/BOP3/ISO 20022 serialization
4. tamper rejection and timing-safe digest path
5. final execution correctness
```

## Key Material

Generate local RSA keys only for local verification or mock SARB testing:

```bash
npm run keys
```

Generated files are intentionally ignored:

```txt
private_key.pem
public_key.pem
```

Never commit private keys, wallet keys, API tokens, Vercel tokens, GitHub tokens, Hugging Face tokens, or RPC secrets.

## Legacy Contract Deployment Notes

The Solidity/Foundry contract stack remains in `contracts/`, `script/`, and `test/`.

Use environment variables for all secrets:

```bash
POLYGON_AMOY_RPC_URL=<rpc-url>
PRIVATE_KEY=<deployer-private-key>
CIRCUIT_BREAKER_ADDRESS=<after-deploy>
ASSET_REGISTRY_ADDRESS=<after-deploy>
TEE_VERIFIER_ADDRESS=<after-deploy>
ORACLE_ADDRESS=<oracle-address>
POLYGONSCAN_API_KEY=<api-key>
```

Do not place real private keys in documentation or committed env files.

## Post-Deploy Checklist

1. Run `npm test` locally or in CI.
2. Deploy with `vercel deploy --prod --yes`.
3. Alias the deployment to `venturevisionubuntu.co.za`.
4. Verify apex HTTPS and `/api/health` return 200.
5. Confirm Vercel domain list contains `venturevisionubuntu.co.za` and not the typo domain.
6. Confirm Git remotes are token-free before pushing.
