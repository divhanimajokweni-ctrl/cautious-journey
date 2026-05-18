// test/gate1-smoke.test.js
// Gate-1 smoke test — Node 20, ESM-native, `node --test`
import { test } from "node:test"
import handler from "../api/verify.js"
import { createHash } from "node:crypto"

const ISSUER_DID = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
const DEED   = createHash("sha256").update("gate-1-smoke-test-deed").digest("hex")
const DEEDMN = createHash("sha256").update("gate-1-mainnet-rejection").digest("hex")

function mockReq(body) {
  return { method: "POST", body }
}

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null }
  res.status    = (c) => { res.statusCode = c; return res }
  res.setHeader = (_k, _v) => res
  res.json      = (p) => { res.body = JSON.stringify(p); return res }
  res.end       = (p) => { res.body = p; return res }
  return res
}

// ── Test 1: AMOY happy-path ──────────────────────────────────────────────────

test("Gate-1 AMOY: signed receipt — posterior[0,1], verdict∈{PASS|WARN|HALT}, pipeline_hash 64-hex, anchored_at null, safegrid_signal, no safefgrid_signal typo", async (t) => {
  const res = mockRes()
  await handler(
    mockReq({
      alpha: 2, beta: 1, gamma: 1.2, threshold: 0.95,
      deed_hash: DEED, issuer_did: ISSUER_DID,
      property_ref: "prop_gate_1_smoke", chain_target: "AMOY",
    }),
    res
  )

  t.assert.strictEqual(res.statusCode, 200, "http 200")
  const p = JSON.parse(res.body)
  t.assert.strictEqual(p.ok, true)
  t.assert.ok(p.posterior >= 0 && p.posterior <= 1, `posterior=${p.posterior} not in [0,1]`)
  t.assert.strictEqual(p.threshold, 0.95)
  t.assert.ok(["PASS","WARN","HALT"].includes(p.verdict), `bad verdict: ${p.verdict}`)
  // receipts: server-generated
  t.assert.match(p.receipt_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  t.assert.strictEqual(p.deed_hash, DEED)
  t.assert.match(p.pipeline_hash, /^[a-f0-9]{64}$/)
  // anchored_at: null — active amends do not overwrite (contract invariant)
  t.assert.strictEqual(p.anchored_at, null, "anchored_at must be null")
  // HMAC-SHA256
  t.assert.match(p.signature, /^hmac-sha256:[a-f0-9]{64}$/)
  // safegrid_signal
  t.assert.ok(p.safegrid_signal,               "safegrid_signal missing")
  t.assert.ok(p.safegrid_signal.signal_id,         "signal_id missing")
  t.assert.strictEqual(p.safegrid_signal.verdict, p.verdict)
  t.assert.ok(p.safegrid_signal.evaluator_version,  "evaluator_version missing")
  // typo guard
  t.assert.strictEqual(p.safefgrid_signal, undefined, "safefgrid_signal must not be in the response")
})

// ── Test 2: MAINNET rejected before computation ──────────────────────────────

test("Gate-1 MAINNET: 400 error, no proof computed", async (t) => {
  const res = mockRes()
  await handler(
    mockReq({
      alpha: 2, beta: 1, gamma: 1.2, threshold: 0.95,
      deed_hash: DEEDMN, issuer_did: ISSUER_DID,
      property_ref: "prop_gate_1_mn_reject", chain_target: "MAINNET",
    }),
    res
  )

  t.assert.strictEqual(res.statusCode, 400, "http 400 for MAINNET")
  const p = JSON.parse(res.body)
  t.assert.strictEqual(p.ok, false)
  t.assert.strictEqual(p.error, "VALIDATION_ERROR")
  t.assert.match(p.errors.join(" "), /AMOY|FABRIC/, "error must mention permitted networks")
  t.assert.strictEqual(p.posterior, undefined, "posterior must not be computed for MAINNET")
})
