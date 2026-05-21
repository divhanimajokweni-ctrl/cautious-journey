/**
 * api/v2/decision.js
 * ----------------------------------------------------------
 * POST /api/v2/decision
 *
 * Computes a Bayesian risk verdict for an entity and produces an
 * EIP-712 typed signature via the oracle signer.
 *
 * Body (two supported modes):
 *
 *   Mode A — entity-only (reads alpha/beta/gamma from the entity DB record):
 *     { entity_id: string }
 *
 *   Mode B — full parameter override:
 *     {
 *       entity_id: string,
 *       alpha:  number,
 *       beta:   number,
 *       gamma:  number,       // default 1.0
 *       threshold: number     // base threshold τ₀ in [0, 1], default 0.60
 *     }
 *
 * Verdict thresholds:
 *   PASS  → safety margin  >  0
 *   WARN  → safety margin === 0
 *   HALT  → safety margin  <  0
 *
 * Flow:
 *   1. Read or create entity stats from the DB
 *   2. Apply any body overrides to alpha / beta / gamma / threshold
 *   3. Compute posterior μ, calibrated τ, margin S, verdict
 *   4. Atomically record a NEUTRAL governance event (nonce = auto-incremented)
 *   5. call signDecision() to produce an EIP-712 signature
 *   6. saveDecision() to persist the full decision record
 *   7. If the entity has a PENDING proposal → promote it to RISK_VERIFIED with decision_id
 *   8. Return the full verdict + signature
 *
 * ESM module — Vercel Serverless Function compatible.
 */

import { randomUUID } from 'node:crypto';
import { signDecision }  from '../../services/security/eip712Signer.js';
import {
  getOrCreateEntityStats,
  recordEvent,
  saveDecision,
  listProposals,
  updateProposal,
} from '../../services/state/db.js';

// ---------------------------------------------------------------------------
// Math helpers (mirrors lib/kernel.js / api/verify.js)
// ---------------------------------------------------------------------------

/**
 * Beta-Binomial posterior mean (Laplace-smoothed).
 * @param {number} alpha
 * @param {number} beta
 * @returns {number} posterior in [0, 1]
 */
function betaMean(alpha, beta) {
  const a = Number(alpha);
  const b = Number(beta);
  return (a + 1) / (a + b + 2);
}

/**
 * Calibrated threshold.
 * τ = τ₀ / (1 + γ · β/α)   when α > 0
 * τ = τ₀                   when α === 0
 *
 * @param {number} baseThreshold  τ₀  in [0, 1]
 * @param {number} gamma         γ  > 0
 * @param {number} alpha         α  ≥ 0
 * @param {number} beta          β  ≥ 0
 * @returns {number}  calibrated τ in [0, 1]
 */
function calibratedThreshold(baseThreshold, gamma, alpha, beta) {
  const t = Number(baseThreshold);
  const g = Number(gamma);
  const a = Number(alpha);
  const b = Number(beta);
  if (a <= 0) return Number.isFinite(t) ? t : 0;
  return t / (1 + g * (b / a));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** @type {(req, res) => Promise<void>} */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed',
      allowed: ['POST'],
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'INVALID_JSON' });
  }

  const { entity_id, alpha, beta, gamma: gIn, threshold: tIn } = body ?? {};

  // ── Validation: entity_id is always required ───────────────────────────────
  if (!entity_id || typeof entity_id !== 'string' || entity_id.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: ['entity_id is required and must be a non-empty string'],
    });
  }

  const eid = entity_id.trim();

  // ── Load entity (DB-backed source of truth for alpha/beta/gamma/threshold) ─
  const stats = await getOrCreateEntityStats(eid);

  const a = alpha      !== undefined ? Number(alpha)      : stats.alpha;
  const b = beta       !== undefined ? Number(beta)       : stats.beta;
  const g = gIn        !== undefined ? Number(gIn)        : stats.gamma || 1.0;
  const tBase = tIn    !== undefined ? Number(tIn)        : stats.posterior || 0.6;

  if (
    !Number.isFinite(a) || a < 0 ||
    !Number.isFinite(b) || b < 0 ||
    !Number.isFinite(g) || g <= 0 ||
    !Number.isFinite(tBase) || tBase < 0 || tBase > 1
  ) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: [
        `alpha (${a}) must be ≥ 0`,
        `beta  (${b}) must be ≥ 0`,
        `gamma (${g}) must be > 0`,
        `threshold (${tBase}) must be in [0, 1]`,
      ].filter(Boolean),
    });
  }

  // ── Compute verdict ────────────────────────────────────────────────────────
  const posterior  = betaMean(a, b);
  const tau        = calibratedThreshold(tBase, g, a, b);
  const margin     = posterior - tau;
  let   verdict;
  if      (margin >  0) verdict = 'PASS';
  else if (margin === 0) verdict = 'WARN';
  else                    verdict = 'HALT';

  // ── Nonce: record a NEUTRAL governance event for atomicity ─────────────────
  const eventResult = await recordEvent({
    entity_id: eid,
    direction: 'NEUTRAL',
    weight:    0,
    meta:      { reason: 'v2/decision nonce generation' },
  });
  const nonce = eventResult.id; // UUID as nonce (sufficiently unique for off-chain)

  // ── EIP-712 signature ────────────────────────────────────────────────────
  const posteriorBp = Math.round(posterior * 10000);
  const tauBp       = Math.round(tau * 10000);
  const now         = Math.floor(Date.now() / 1000);

  let signResult;
  try {
    signResult = await signDecision({
      entity_id:  eid,
      belief:     posteriorBp,
      threshold:  tauBp,
      verdict,
      nonce:      BigInt(Date.now().toString(36) + nonce.slice(0, 8), 36) || nonce.slice(0, 8),
      timestamp:  now,
    });
  } catch (err) {
    return res.status(500).json({
      ok:    false,
      error: 'SIGNING_FAILED',
      detail: err.message,
    });
  }

  // ── Persist decision ──────────────────────────────────────────────────────
  const decision = await saveDecision({
    id:                   randomUUID(),
    entity_id:            eid,
    belief_bp:            posteriorBp,
    threshold_bp:         tauBp,
    verdict,
    signature:            signResult.signature,
    nonce:                signResult.value.nonce.toString(),
    timestamp:            now,
    domain:               signResult.domain,
    types:                signResult.types,
    value:                signResult.value,
    posterior,
    calibrated_threshold: tau,
    margin,
    created_at:           new Date().toISOString(),
  });

  // ── Auto-promote PENDING proposals for this entity ─────────────────────────
  try {
    const pending = await listProposals({ entity_id: eid, status: 'PENDING' });
    for (const p of pending) {
      await updateProposal(p.id, {
        status:      'RISK_VERIFIED',
        decision_id: decision.id,
        risk_score:  margin,
        updated_at:  new Date().toISOString(),
      });
    }
  } catch (err) {
    // Non-fatal
    // eslint-disable-next-line no-console
    console.error(`[decision] failed to auto-promote proposals for ${eid}:`, err.message);
  }

  // ── Return ────────────────────────────────────────────────────────────────
  return res.status(200).json({
    ok:                  true,
    entity_id:           eid,
    alpha:               a,
    beta:                b,
    posterior:           Number(posterior.toFixed(6)),
    threshold:           Number(tBase.toFixed(6)),
    calibrated_threshold: Number(tau.toFixed(6)),
    margin:              Number(margin.toFixed(6)),
    verdict,
    signature:           signResult.signature,
    nonce:               signResult.value.nonce.toString(),
    decision_id:         decision.id,
    receipt_id:          decision.id,
  });
}
