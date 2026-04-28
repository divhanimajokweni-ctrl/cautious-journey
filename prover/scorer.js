// prover/scorer.js
// Computes the probabilistic trigger score for ProofBridge Liner evidentiary layer.
//
// Based on Beta-Binomial conjugate model with prior Beta(α0, β0) where:
// - α0 = 1 (prior belief in divergence)
// - β0 = 10 (prior belief in validity, conservative)
//
// τ_t = P(H_t=1 | evidence) ≈ (α0 + m_t) / (α0 + β0 + r_t)
//
// Where:
// - m_t: number of gateways reporting hash mismatch
// - r_t: number of responding gateways (successful fetches)

const ALPHA0 = 1;
const BETA0 = 10;

/**
 * Computes the trigger score for a single asset result.
 * @param {Object} result - Asset result from fetcher.js
 * @returns {number} triggerScore - Posterior probability of divergence (0-1)
 */
function computeTriggerScore(result) {
  if (!result.gatewayResults) {
    throw new Error('gatewayResults not available in result');
  }

  const successes = result.gatewayResults.filter(r => r.ok);
  const mismatches = successes.filter(r => r.hash !== result.expectedHash);

  const m_t = mismatches.length;
  const r_t = successes.length;

  // Require at least 2 responding gateways
  if (r_t < 2) {
    return 0; // Cannot trip without quorum
  }

  const tau_t = (ALPHA0 + m_t) / (ALPHA0 + BETA0 + r_t);
  return tau_t;
}

/**
 * Adds triggerScore to each result in prover state.
 * @param {Object} proverState - Full prover state object
 * @returns {Object} Updated prover state with triggerScore added
 */
function enrichStateWithScores(proverState) {
  if (!proverState.results || !Array.isArray(proverState.results)) {
    throw new Error('Invalid prover state: missing results array');
  }

  const enrichedResults = proverState.results.map(result => ({
    ...result,
    triggerScore: computeTriggerScore(result)
  }));

  return {
    ...proverState,
    results: enrichedResults
  };
}

module.exports = {
  ALPHA0,
  BETA0,
  computeTriggerScore,
  enrichStateWithScores
};