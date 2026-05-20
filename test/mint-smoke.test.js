// test/mint-smoke.test.js
// Gate-1 mint smoke test — ESM-native, Node test runner.
import { test } from "node:test"
import handler from "../api/mint.js"
import { createHash } from "node:crypto"

const DEED = createHash("sha256").update("gate-1-mint-smoke-deed").digest("hex")
const NONCE = createHash("sha256").update("gate-1-mint-smoke-nonce").digest("hex")

function mockReq(body) {
  return { method: "POST", body }
}

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.setHeader = (key, value) => { res.headers[key] = value; return res }
  res.json = (payload) => { res.body = JSON.stringify(payload); return res }
  res.end = (payload) => { res.body = payload; return res }
  return res
}

test("Gate-1 mint: client_nonce required and PASS payload serialized", async (t) => {
  const res = mockRes()
  await handler(
    mockReq({
      alpha: 4, beta: 4, gamma: 1, threshold: 0.55,
      deed_hash: DEED,
      client_nonce: NONCE,
      chain_target: "AMOY",
    }),
    res
  )

  t.assert.strictEqual(res.statusCode, 200, "http 200")
  const p = JSON.parse(res.body)
  t.assert.strictEqual(p.status, "VERIFIED_SOVEREIGN_TRUTH")
  t.assert.strictEqual(p.payload.ok, true)
  t.assert.strictEqual(p.payload.verdict, "PASS")
  t.assert.strictEqual(p.payload.client_nonce, NONCE)
  t.assert.match(p.signature, /^hmac-sha256:[a-f0-9]{64}$/)
})
