/**
 * api/v2/events.js
 * ----------------------------------------------------------
 * POST /api/v2/events
 *
 * Replaces manual alpha/beta knobs with a streaming event feed.
 *
 * Body:
 *   {
 *     entity_id: string,           // required
 *     direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',  // required
 *     weight:    number,           // optional, default 1
 *     meta?:      object           // optional free-form metadata
 *   }
 *
 * - POSITIVE  → bumps α (alpha += weight)
 * - NEGATIVE  → bumps β (beta  += weight)
 * - NEUTRAL   → no count change; only creates an event record
 *
 * Reads/writes to the file-backed state store (services/state/db.js).
 *
 * ESM module — Vercel Serverless Function compatible.
 */

import { randomUUID } from 'node:crypto';
import { recordEvent, getOrCreateEntityStats, getEntityEvents } from '../../services/state/db.js';

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

  const { entity_id, direction, weight, meta } = body ?? {};

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!entity_id || typeof entity_id !== 'string' || entity_id.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: ['entity_id is required and must be a non-empty string'],
    });
  }

  const VALID_DIRECTIONS = new Set(['POSITIVE', 'NEGATIVE', 'NEUTRAL']);
  const dir = String(direction ?? '').toUpperCase();
  if (!VALID_DIRECTIONS.has(dir)) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: [`direction must be one of ${[...VALID_DIRECTIONS].join(', ')}`],
    });
  }

  const w = Number(weight ?? 1);
  if (!Number.isFinite(w) || w < 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: ['weight must be a non-negative number'],
    });
  }

  try {
    // ── Record event (atomically bumps α / β) ───────────────────────────────
    const result = await recordEvent({
      entity_id: entity_id.trim(),
      direction: dir,
      weight:    w,
      meta:      meta || null,
    });

    // ── Fetch recent events ─────────────────────────────────────────────────
    const recent = await getEntityEvents(entity_id.trim(), 20);

    return res.status(200).json({
      ok: true,
      event_id:   result.event_id,
      entity_id:  result.entity_id,
      alpha:      result.alpha,
      beta:       result.beta,
      posterior:  result.posterior,
      recent_events: recent.map((e) => ({
        id:         e.id,
        direction:  e.direction,
        weight:     e.weight,
        created_at: e.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      ok:  false,
      error: 'INTERNAL_ERROR',
      detail: err.message,
    });
  }
}
