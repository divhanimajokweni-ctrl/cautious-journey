# Deprecated — VVV API Kernel

> ⚠️ **This directory is deprecated. Do not import from `vvv/api/verify.js` in any
> Gate-1 verification path.**

`vvv/api/verify.js` (now `deprecated/vvv-api/verify.legacy.js`) was the legacy SAFE / TRIP
beta-mean kernel used by the V0.9 safety stack.

## Why it is deprecated

| Aspect         | Legacy `vvv/api/verify.js`        | Gate-1 `api/verify.js`         |
|----------------|-----------------------------------|--------------------------------|
| Input          | alpha, beta, gamma, threshold     | + deed_hash, issuer_did, chain_target |
| Output         | belief, verdict (SAFE / TRIP), signature | posterior, PASS \| WARN \| HALT, receipt_id, pipeline_hash, anchored_at: null, safegrid_signal |
| HMAC secret env | `KERNEL_SECRET`                   | `PROOFBRIDGE_HMAC_SECRET`     |
| Verdict model  | SAFE / TRIP                       | PASS / WARN / HALT             |
| Anchoring      | N/A                               | `anchored_at: null` invariant   |

## Production routing

Vercel routes `/api/verify` → **root `api/verify.js`** (Gate-1).

The `vvv/` directory is served as **static assets only** by Vercel. It is not invoked
as a serverless function under Gate-1.

## Migration checklist

- [ ] Update any client code to POST to `/api/verify` (root handler)
- [ ] Replace `KERNEL_SECRET` env-var reference with `PROOFBRIDGE_HMAC_SECRET`
- [ ] Remove imports of `vvv/api/verify.js` or `vvv/lib/kernel.js` (both deprecated)
- [ ] Confirm CI runs `test/gate1-smoke.test.js` against the root handler
