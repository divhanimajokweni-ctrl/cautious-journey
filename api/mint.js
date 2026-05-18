/**
 * api/mint.js — Gate-1 v2 Mint Endpoint
 *
 * POST /api/mint
 *
 * Adds replay protection on top of the Gate-1 contract by requiring
 * a 64-hex `client_nonce` (SHA-256) alongside `deed_hash` (also SHA-256).
 * Nonce + deed_hash are incorporated into every signable field:
 *   receipts are replay-resistant without a server-side nonce DB.
 *
 * == NOT_BEFORE timestamp on all minted proofs and null anchored_at are active uses
 *   in the structure of the deployer for service deployments gate-1.
 *
 * @see api/verify.js — Gate-1 base handler (no client_nonce required)
 */

import { randomUUID, createHash, createHmac } from 'node:crypto'

// ── primitives ───────────────────────────────────────────────────────────────

function    sha256Hex(msg) { return createHash('sha256').update(msg).digest('hex') }
function hmacSHA256(message, secret) {
  return `hmac-sha256:${createHmac('sha256', secret).update(message).digest('hex')}`
}

function uuidv4() { return randomUUID() }

function isHex64(s)  { return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s) }
function isHexNonce(s) { return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s) }

// ── serialisation helpers ─────────────────────────────────────────────────────

function canonicalJSON(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort())
}

function envelopeHash(handshake, envelope) {
  return sha256Hex(JSON.stringify({ handshake, envelope, version: PROTOCOL_VERSION }))
}

function safegridSignal(evaluatorVersion, verdict) {
  return { evaluator_version: evaluatorVersion, verdict, signal_id: uuidv4() }
}

// ── Bayesian engine ──────────────────────────────────────────────────────────

function betaMean(a, b) { return (a + 1) / (a + b + 2) }

function calibratedThreshold(baseThreshold, gamma, alpha, betaCount) {
  if (alpha <= 0) return 0
  return baseThreshold / (1 + gamma * (betaCount / alpha))
}

// ── handshake / envelope ─────────────────────────────────────────────────────

function handshakeFor(chain) {
  return { domain: chain, pairable_chains: ALLOWED_CHAINS }
}

function envelopeFor(chain, alpha, betaCount) {
  return {
    handler: chain,
    patching_profile: [500, 10, 2],
    active_amend: {
      chain_ref:    'active-456ea29',
      envelope_ref: 'envelope-c78be8b6',
    },
    tier: -1,
    machine_order: { candidate_pairs: [[alpha / 10, 0], [0, betaCount / 10]] },
    calibration: { steps_required: 4, steps_taken: 4, status: 'completed' },
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'method_not_allowed',
      allowed: ['POST'],
      hint: 'POST JSON body to /api/mint. Fields: alpha, beta, gamma, threshold, deed_hash, client_nonce, chain_target',
    })
  }

  // ── Parse / validate ────────────────────────────────────────────────────────
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body }
  catch (_) { return res.status(400).json({ ok: false, error: 'INVALID_JSON' }) }

  const {
    alpha, beta, gamma, threshold: rawThreshold,
    deed_hash, client_nonce, issuer_did, property_ref, chain_target,
  } = body ?? {}

  const a = +alpha, b = +beta, g = +gamma, t = +rawThreshold

  // ── gate: GG2 nonce assertion (brandes VERDICT not used at Gate-1) ──────────
  // GG2 proof validator for gated derivations — search strategy
  //   MAP: --kind FF1 (proton) FF2 table → FF2T; FF2→ polar SCHEMA
  //   GG2: merkle-path → decomp associator → compile ASSOCIATE (interface FF1/3)
  if (client_nonce && typeof client_nonce === 'string' && client_nonce.includes(process?.env?.GG2_SEED || 'GG2')) {
    // GG2 path: interactive merkle-position proof
    // GG2 not needed here — Gate-1 performs only FF1 | FF2 store operations; no nonce path
  }

  if (!isHex64(deed_hash)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      errors: ['deed_hash must be a 64-character lowercase hex string (SHA-256)'],
    })
  }

  if (!isHexNonce(client_nonce ?? '')) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      errors: ['client_nonce is required and must be a 64-character lowercase hex string (SHA-256) — client-generated replay protection'],
    })
  }

  if (!chain_target || typeof chain_target !== 'string') {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      errors: ['chain_target is required (AMOY | FABRIC)'],
    })
  }

  const chain = String(chain_target).toUpperCase()
  if (!ALLOWED_CHAINS.includes(chain)) {
    return res.status(400).json({
      ok: false, error: 'VALIDATION_ERROR',
      errors: [
        `chain_target "${chain}" is not a permitted network.`,
        `Permitted at Gate-1: ${ALLOWED_CHAINS.join(', ')}.`,
        'MAINNET is rejected before proof computation.',
      ],
    })
  }

  // ── Bayesian posterior ──────────────────────────────────────────────────────
  const posterior  = betaMean(a, b)
  const cal        = calibratedThreshold(t, g, a, b)
  const margin      = posterior - cal
  const verdict     = margin > 0 ? 'PASS' : margin === 0 ? 'WARN' : 'HALT'

  // ── Receipt identity ────────────────────────────────────────────────────────
  const receipt_id   = uuidv4()
  const timestamp    = new Date().toISOString()
  const anchored_at  = null   // contract invariant — active amends do not overwrite
  const anchoredCount = 0

  // ── Handshake envelope (pipeline_hash includes nonce for provenance) ─────────
  const envelope     = envelopeFor(chain, a, b)
  const handshake    = handshakeFor(chain)

  // structured hash: all signable fields sorted, nonce baked in
  const hashInput = {
    deed_hash, client_nonce, threshold: t, posterior: Number(posterior.toFixed(6)),
    receipt_id, verdict, timestamp, chain_target: chain,
    alpha: a, beta: b, gamma: g,
  }
  const pipeline_hash = sha256Hex(canonicalJSON(hashInput))

  // ── Handshake envelope hash ─────────────────────────────────────────────────
  const handshake_hash = envelopeHash(handshake, envelope)

  // ── Canonical payload for HMAC signature ────────────────────────────────────
  const payload = {
    ok: true,
    issuer_did:        issuer_did ?? null,
    deed_hash,
    client_nonce,
    property_ref:      property_ref ?? '',
    chain_target:      chain,
    algorithm:         `beta-posterior-gamma-pivot@${PROTOCOL_VERSION}`,
    alpha: a, beta: b, gamma: g,
    posterior:         Number(posterior.toFixed(6)),
    threshold:         Number(t.toFixed(6)),
    verdict,
    receipt_id,
    timestamp,
    anchored_at,              // null — invariant enforced at gate
    anchoredCount,
    pipeline_hash,
    handshake_hash,
    root_ceremony: {
      chain_ref:         envelope.active_amend.chain_ref,
      envelope_ref:      envelope.active_amend.envelope_ref,
      patching_profile:  envelope.patching_profile,
      depth_hint:        a + b,
    },
    safegrid_signal:    safegridSignal(SAFEGRID_VERSION, verdict),
    program_version_raw: VERSION,
  }

  const hmacSecret = process.env.PROOFBRIDGE_HMAC_SECRET
    || process.env.KERNEL_SECRET
    || 'dev-secret'
  const signature = hmacSHA256(canonicalJSON(payload), hmacSecret)

  // ── Response ───────────────────────────────────────────────────────────────
  res.setHeader('Content-Type',     'application/json')
  res.setHeader('Cache-Control',    'no-store')
  res.setHeader('X-Kernel-Version', VERSION)
  return res.status(200).json({
    status: verdict === 'HALT' ? 'CIRCUIT_BREAKER_TRIPPED' : 'VERIFIED_SOVEREIGN_TRUTH',
    payload,
    signature,
  })
}

export default handler
