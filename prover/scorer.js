// prover/scorer.js
// Stratified probabilistic evidence scoring for ProofBridge Liner v2.0.
//
// Replaces the single-threshold model with per-class decision boundaries.
// Three scenario classes:
//   A – Weak evidence   (single mismatch, likely transient artefact)
//   B – Strong evidence (multi-gateway consistent mismatch)
//   C – Unreachable     (network failure, handled by fetcher retry logic)
//
// The classification is deterministic, the thresholds are configurable
// in config/scoring.json.

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Configuration (defaults — override in config/scoring.json)
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.resolve(__dirname, '..', 'config', 'scoring.json');

let config = {
  // Prior parameters for Beta-Binomial posterior
  priorAlpha: 1,
  priorBeta: 10,

  // Class-specific thresholds (posterior mean)
  thresholdA: 0.60,   // Class A – single gateway mismatch → require stronger evidence
  thresholdB: 0.355,   // Class B – consistent multi-gateway mismatch → trip earlier

  // Class B definition: at least minMismatchesB mismatches AND
  // at least minGatewaysB responding gateways.
  minMismatchesB: 2,
  minGatewaysB: 2,
};

// Load external configuration if present
if (fs.existsSync(CONFIG_PATH)) {
  const userConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  config = { ...config, ...userConfig };
}

// ---------------------------------------------------------------------------
// Compute Beta-Binomial posterior mean (triggerScore)
// ---------------------------------------------------------------------------
function computePosteriorMean(mismatches, total, alpha, beta) {
  if (total === 0) return 0; // no evidence
  const alphaPost = alpha + mismatches;
  const betaPost = beta + (total - mismatches);
  return alphaPost / (alphaPost + betaPost);
}

// ---------------------------------------------------------------------------
// Scenario classification
// ---------------------------------------------------------------------------
function classify(mismatches, totalResponded, allUnreachable) {
  // Class C: total network failure → rely on fetcher's MAX_UNREACHABLE_RETRIES
  if (allUnreachable) return 'C';

  // Class B: consistent multi-gateway mismatch
  if (mismatches >= config.minMismatchesB && totalResponded >= config.minGatewaysB) {
    return 'B';
  }

  // Class A: weak or isolated evidence (single mismatch, or few responders)
  return 'A';
}

// ---------------------------------------------------------------------------
// Main scoring function — called from fetcher after each poll cycle
// ---------------------------------------------------------------------------
function scoreAsset(gatewayResults, expectedHash) {
  const total = gatewayResults.length;
  const mismatches = gatewayResults.filter(g => g.ok && g.hash !== expectedHash).length;
  const responded = gatewayResults.filter(g => g.ok).length;
  const allUnreachable = responded === 0;

  // Compute triggerScore (for observability / auditing)
  const triggerScore = computePosteriorMean(
    mismatches,
    responded,
    config.priorAlpha,
    config.priorBeta
  );

  // Classify the scenario
  const scenario = classify(mismatches, responded, allUnreachable);

  // Determine whether to trip based on class-specific threshold
  let trip = false;
  let thresholdUsed = null;

  if (scenario === 'A') {
    thresholdUsed = config.thresholdA;
    trip = triggerScore >= thresholdUsed;
  } else if (scenario === 'B') {
    thresholdUsed = config.thresholdB;
    trip = triggerScore >= thresholdUsed;
  }
  // Class C does not trip here; handled by unreachable retry logic in fetcher/submitter

  return {
    triggerScore,
    scenario,
    thresholdUsed,
    trip,
    mismatches,
    responded,
    total,
  };
}

module.exports = { scoreAsset, computePosteriorMean, classify, config };