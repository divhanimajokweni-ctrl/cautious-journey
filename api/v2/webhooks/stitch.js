/**
 * api/v2/webhooks/stitch.js
 * ----------------------------------------------------------
 * POST /api/v2/webhooks/stitch
 *
 * Stitch settlement webhook — processes payment settlement confirmations
 * and routes them to the correct proposal via reference/transaction path.
 *
 * Headers:
 *   x-stitch-signature  HMAC-SHA256 of the raw body using STITCH_SECRET
 *
 * Body (Stitch webhook event):
 *   {
 *     event_id: string,
 *     event_type: string,   // e.g. "payment.settled", "payment.failed"
 *     payment_id: string,   // or transaction_id
 *     status: string,
 *     reference: string,    // client reference (maps to PBL-XXXXXXXX)
 *     amount: number,
 *     timestamp: string,
 *     ... (free-form extras)
 *   }
 *
 * Processing logic (settlement confirmations only):
 *   1. HMAC-validate the request
 *   2. Extract entity_id  ← reference field  (PBL-XXXXXXXX → proposal)
 *   3. Find the proposal matching proposal.entity_id or proposal.transaction_id
 *   4. Update proposal: status = 'SETTLED'
 *   5. Record a POSITIVE risk event on the entity
 *
 * ESM module — Vercel Serverless Function compatible.
 */

import { randomUUID } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getProposalsByEntity, updateProposal, recordEvent, listProposals } from '../../services/state/db.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_EVENT_TYPES = new Set([
  'payment.settled',
  'payment.completed',
  'payment.paid',
  'payment.success',
  'payment.failed',
  'payment.cancelled',
  'payment.expired',
  'payment.initiated',
]);

/** @type {string} */
let STITCH_SECRET = '';
try { STITCH_SECRET = process.env.STITCH_SECRET || process.env.STITCH_WEBHOOK_SECRET || ''; } catch { /* env not set during unit tests */ }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the raw request body buffer from the Node.js request stream.
 * Vercel normally populates req.body but for HMAC verification we need
 * the raw bytes. Falls back to req.body if raw stream is unavailable.
 */
async function readRawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) {
    return Buffer.from(req.rawBody);
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    return Buffer.from(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Validate the x-stitch-signature timestamp-windowed HMAC.
 * Stitch signs the raw body:  sha256(body_text) with STITCH_SECRET
 *
 * @param {Buffer} rawBody
 * @param {string} signatureHeader
 * @returns {boolean}
 */
function validateHMAC(rawBody, signatureHeader) {
  if (!STITCH_SECRET) return false; // skip HMAC check when secret is not configured

  // Accept either bare hex or sha256= prefixed
  const provided = String(signatureHeader).replace(/^sha256=/, '').trim();
  const expected = createHmac('sha256', STITCH_SECRET).update(rawBody).digest('hex');

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Normalise a Stitch reference (strips the PBL- prefix and lowercases).
 * PBL-XXXXXXXX → xxxxxxxx  (for proposal lookup)
 */
function stripPrefix(ref) {
  if (typeof ref !== 'string') return ref;
  return ref.replace(/^PBL-/i, '');
}

/**
 * Find the best matching proposal for a settlement event.
 * Tries transaction_id first, then entity_id, then reference prefix.
 *
 * @param {object} event
 * @returns {Promise<{ id: string, proposal: any } | null>}
 */
async function findMatchingProposal(event) {
  const txId      = event.payment_id || event.transaction_id;
  const reference = event.reference;
  console.debug('[stitch-webhook] findMatchingProposal', { txId, reference });

  // Try transaction_id (most specific)
  if (txId) {
    const byTx = await listProposals({}, 100);
    const match = byTx.find((p) => p.transaction_id === txId);
    if (match) return { id: match.id, proposal: match };
  }

  // Try entity_id derived from reference
  if (reference) {
    const plainRef = stripPrefix(reference);
    // Look across all proposals for a matching entity_id OR reference
    const byEntity = await listProposals({}, 500);
    const match = byEntity.find(
      (p) =>
        p.entity_id === plainRef ||
        p.entity_id === reference ||
        (p.reference || '').toLowerCase() === reference.toLowerCase()
    );
    if (match) return { id: match.id, proposal: match };
  }

  return null;
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

  // ── HMAC validation ────────────────────────────────────────────────────────
  const rawBody = await readRawBody(req);

  if (STITCH_SECRET) {
    const sigHeader = req.headers['x-stitch-signature'] || '';
    if (!validateHMAC(rawBody, sigHeader)) {
      return res.status(401).json({ ok: false, error: 'invalid_signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  // ── Event classification ───────────────────────────────────────────────────
  const eventType  = (event.event_type || event.type || '').toLowerCase();
  const status     = (event.status || event.state || event.event_type || '').toLowerCase();
  const combined   = `${eventType}.${status}`;
  const isAccepted = ACCEPTED_EVENT_TYPES.has(combined) || eventType.startsWith('payment');

  // ── Non-settlement events — ack but skip processing ──────────────────────
  if (!combined.includes('settled') && !combined.includes('completed') && !combined.includes('paid')) {
    return res.status(200).json({
      ok:         true,
      rail:       'stitch',
      processed:  false,
      reason:     `non-settlement event "${combined}" — acknowledged, no action taken`,
      event_type: eventType,
      status,
    });
  }

  // ── Settlement confirmation: update proposal + record event ────────────────
  const paymentId   = event.payment_id || event.transaction_id   || '';
  const reference   = event.reference    || event.client_reference || '';
  const entity_id   = stripPrefix(reference) || event.entity_id || paymentId;

  let updated = false;
  let proposalMatch = null;

  try {
    proposalMatch = await findMatchingProposal(event);

    if (proposalMatch) {
      await updateProposal(proposalMatch.id, {
        status:      'SETTLED',
        transaction_id: paymentId || proposalMatch.proposal.transaction_id,
        updated_at:  new Date().toISOString(),
        meta:        {
          ...(proposalMatch.proposal.meta || {}),
          settlement_event: event,
        },
      });
      updated = true;

      // Record a POSITIVE event when settlement is confirmed
      try {
        await recordEvent({
          entity_id:  proposalMatch.proposal.entity_id || entity_id,
          direction:  'POSITIVE',
          weight:     1,
          meta:       {
            proposal_id:    proposalMatch.id,
            transaction_id: paymentId,
            event_type:     combined,
            action:         'payment_settled',
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          '[stitch-webhook] failed to record settlement event:',
          err.message
        );
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stitch-webhook] settlement processing error:', err.message);
  }

  return res.status(200).json({
    ok:         true,
    rail:       'stitch',
    processed:  updated,
    event_type: eventType,
    status,
    payment_id: paymentId,
    entity_id,
    proposal_updated: updated,
    proposal_id:      proposalMatch?.id || null,
  });
}
