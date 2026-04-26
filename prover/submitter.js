/**
 * prover/submitter.js
 * ----------------------------------------------------------
 * Phase 3 component #3: relays fetcher results on-chain.
 *
 * Reads .local/state/prover-state.json (produced by fetcher.js)
 * and, for every asset with status "fresh", calls
 * CircuitBreaker.updateProof(assetId, deedHash). For any asset
 * with status "mismatch" it calls tripCircuit(reason).
 *
 * For Phase 3 this is implemented as a dry-run logger; wiring the
 * actual ethers.js broadcast happens once the contract is verified
 * on Polygon Amoy and CIRCUIT_BREAKER_ADDRESS is set.
 */

const fs = require('fs');
const path = require('path');

const STATE_PATH = path.resolve(__dirname, '..', '.local', 'state', 'prover-state.json');

function planActions(state) {
  const actions = [];
  for (const r of state.results) {
    if (r.status === 'fresh') {
      actions.push({
        kind: 'updateProof',
        assetId: r.assetId,
        deedHash: r.actualHash,
      });
    } else if (r.status === 'mismatch') {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `mismatch: expected ${r.expectedHash}, got ${r.actualHash}`,
      });
    } else if (r.status === 'unreachable') {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `unreachable: ${r.error || 'unknown'}`,
      });
    }
  }
  return actions;
}

function main() {
  if (!fs.existsSync(STATE_PATH)) {
    console.error('[submitter] no prover state found; run fetcher.js first.');
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const actions = planActions(state);
  console.log(`[submitter] planning ${actions.length} on-chain action(s) (dry-run)`);
  for (const a of actions) {
    if (a.kind === 'updateProof') {
      console.log(`  -> updateProof(${a.assetId}, ${a.deedHash})`);
    } else {
      console.log(`  -> tripCircuit(${a.assetId}, "${a.reason}")`);
    }
  }
  console.log('[submitter] dry-run complete. Set CIRCUIT_BREAKER_ADDRESS + PRIVATE_KEY to broadcast.');
}

if (require.main === module) main();

module.exports = { planActions };
