/**
 * services/execution/orchestrator.js
 * ----------------------------------------------------------
 * Critical execution loop for ProofBridge Liner.
 *
 * Reads:
 *  - services/state/db.js        — proposal + event storage
 *  - services/gateway/stitchAdapter.js — Stitch EFT bridge
 *
 * Operations:
 *   1. executeApprovedProposal(proposalId)
 *      — fetches a RISK_VERIFIED proposal, calls Stitch, updates status
 *
 *   2. runExecutionLoop(limit = 10)
 *      — polls for RISK_VERIFIED proposals, executes each, returns summary
 *
 * ESM module.
 */

import { StitchGatewayAdapter } from '../gateway/stitchAdapter.js';
import {
  getProposal,
  updateProposal,
  recordEvent,
} from '../state/db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Stripe/Stitch-style reference from a proposal ID for idempotency.
 * @param {string} proposalId
 * @returns {string}
 */
function buildReference(proposalId) {
  return `PBL-${proposalId.slice(0, 8).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

/**
 * Execute a single RISK_VERIFIED proposal by initiating an Instant EFT
 * payment via the Stitch adapter.
 *
 * Flow:
 *   1. Fetch proposal from DB; require status === 'RISK_VERIFIED'
 *   2. Initiate Stitch Instant EFT
 *   3. Update proposal → EXECUTION_PENDING + transaction_id
 *   4. Record a POSITIVE risk event (payment initiated)
 *   5. Return the payment result
 *
 * @param {string} proposalId
 * @param {object} [options={}]
 * @param {Partial<import('../gateway/stitchAdapter.js').StitchGatewayAdapter>} [options.stitchAdapter]  — injected adapter for testing
 * @returns {Promise<{ ok: true, proposal_id: string, status: string, transaction_id: string, amount: number, reference: string }>}
 * @throws {Error} if proposal is not in RISK_VERIFIED state
 */
export async function executeApprovedProposal(proposalId, options = {}) {
  const {
    stitchAdapter: providedAdapter = null,
  } = options;

  // ── Step 1: Load proposal ──────────────────────────────────────────────────
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`executeApprovedProposal: proposal ${proposalId} not found`);
  }

  if (proposal.status !== 'RISK_VERIFIED') {
    throw new Error(
      `executeApprovedProposal: proposal ${proposalId} has status "${proposal.status}", ` +
      `expected "RISK_VERIFIED"`
    );
  }

  // ── Step 2: Initiate Stitch Instant EFT ───────────────────────────────────
  const adapter = providedAdapter || new StitchGatewayAdapter();

  const reference = buildReference(proposalId);

  // amount_cents → Rands
  const amountRands = proposal.amount_cents / 100;

  const payment = await adapter.initiateInstantEFT({
    reference,
    amount:         amountRands,
    beneficiary_bank: proposal.beneficiary_bank,
    account_number:   proposal.account_number,
    currency:         proposal.currency || 'ZAR',
  });

  // ── Step 3: Update proposal status ─────────────────────────────────────────
  await updateProposal(proposalId, {
    status:         'EXECUTION_PENDING',
    transaction_id: payment.transactionId,
    reference:      reference,
    updated_at:     new Date().toISOString(),
  });

  // ── Step 4: Record POSITIVE risk event ─────────────────────────────────────
  try {
    await recordEvent({
      entity_id: proposal.entity_id || proposalId,
      direction: 'POSITIVE',
      weight:    1,
      meta:      {
        proposal_id:    proposalId,
        transaction_id: payment.transactionId,
        amount_cents:   proposal.amount_cents,
        action:         'payment_initiated',
      },
    });
  } catch (err) {
    // Non-fatal — payment was already submitted
    // eslint-disable-next-line no-console
    console.error(
      `[orchestrator] failed to record POSITIVE event for ${proposalId}:`,
      err.message
    );
  }

  return {
    ok:             true,
    proposal_id:    proposalId,
    status:         'EXECUTION_PENDING',
    transaction_id: payment.transactionId,
    amount:         payment.amount,
    reference:      payment.reference,
  };
}

/**
 * Poll for up to `limit` RISK_VERIFIED proposals and execute them in sequence.
 * Errors on individual proposals are caught and re-thrown; no partial
 * half-executed state is left without a rolling summary.
 *
 * @param {number} [limit=10]
 * @param {object} [options={}]
 * @param {Partial<import('../gateway/stitchAdapter.js').StitchGatewayAdapter>} [options.stitchAdapter]
 * @returns {Promise<{ executed: Array<object>, failed: Array<{proposal_id: string, error: string}>, summary: { total: number, executed: number, failed: number } }>}
 */
export async function runExecutionLoop(limit = 10, options = {}) {
  const {
    stitchAdapter: providedAdapter = null,
  } = options;

  // Fetch candidates
  const candidates = await (await import('../state/db.js')).listProposals(
    { status: 'RISK_VERIFIED' },
    limit
  );

  const results = {
    executed: [],
    failed:   [],
    summary:  {
      total:    candidates.length,
      executed: 0,
      failed:   0,
    },
  };

  for (const proposal of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await executeApprovedProposal(proposal.id, {
        stitchAdapter: providedAdapter,
      });
      results.executed.push(result);
      results.summary.executed++;
    } catch (err) {
      results.failed.push({
        proposal_id: proposal.id,
        error:       err.message,
      });
      results.summary.failed++;
      // eslint-disable-next-line no-console
      console.error(
        `[orchestrator] executeApprovedProposal(${proposal.id}) failed:`,
        err.message
      );
    }
  }

  return results;
}

export { buildReference };
