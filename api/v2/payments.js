/**
 * api/v2/payments.js
 * ----------------------------------------------------------
 * POST /api/v2/payments/initiate
 *
 * Initiate an instant EFT payment for an approved proposal.
 *
 * Body:
 *   { proposal_id: string }
 *
 * Pre-conditions:
 *   — proposal must exist and have status === 'RISK_VERIFIED'
 *
 * Flow:
 *   1. Read proposal from DB (services/state/db.js)
 *   2. Delegate to services/execution/orchestrator.executeApprovedProposal()
 *   3. Return the payment result
 *
 * ESM module — Vercel Serverless Function compatible.
 */

import { randomUUID } from 'node:crypto';
import { executeApprovedProposal } from '../../services/execution/orchestrator.js';
import { getProposal, updateProposal, recordEvent } from '../../services/state/db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Stitch/ISO-style reference string for the payment idempotency key.
 * @param {string} proposalId
 * @returns {string}
 */
function buildReference(proposalId) {
  return `PBL-${proposalId.slice(0, 8).toUpperCase()}`;
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

  const { proposal_id } = body ?? {};

  if (!proposal_id || typeof proposal_id !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      errors: ['proposal_id is required and must be a string'],
    });
  }

  const proposalId = proposal_id.trim();

  // ── Step 1: Validate proposal state ───────────────────────────────────────
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    return res.status(404).json({
      ok:    false,
      error: 'PROPOSAL_NOT_FOUND',
      detail: `No proposal found with id ${proposalId}`,
    });
  }

  if (proposal.status !== 'RISK_VERIFIED') {
    return res.status(409).json({
      ok:         false,
      error:      'WRONG_PROPOSAL_STATUS',
      detail:     `Proposal ${proposalId} has status "${proposal.status}", expected "RISK_VERIFIED"`,
      status:     proposal.status,
    });
  }

  try {
    // ── Step 2: Execute ──────────────────────────────────────────────────────
    const result = await executeApprovedProposal(proposalId);

    // ── Step 3: Record a neutral audit event ─────────────────────────────────
    try {
      await recordEvent({
        entity_id:  proposal.entity_id || proposalId,
        direction:  'NEUTRAL',
        weight:     0,
        meta:       {
          proposal_id:    proposalId,
          transaction_id: result.transaction_id,
          action:         'payment_initiated_v2',
          amount_cents:   proposal.amount_cents,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[api/v2/payments] failed to record event for ${proposalId}:`,
        err.message
      );
    }

    return res.status(200).json({
      ok:             true,
      proposal_id:    proposalId,
      status:         result.status,
      transaction_id: result.transaction_id,
      amount:         result.amount,
      reference:      result.reference,
    });
  } catch (err) {
    // ── Update proposal to FAILED on execution error ─────────────────────────
    try {
      await updateProposal(proposalId, {
        status:      'FAILED',
        meta:        {
          ...(proposal.meta || {}),
          execution_error: err.message,
        },
        updated_at:  new Date().toISOString(),
      });
    } catch {
      // best-effort only
    }

    return res.status(500).json({
      ok:    false,
      error: 'EXECUTION_FAILED',
      detail: err.message,
    });
  }
}
