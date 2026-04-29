// test/recalibrate-thresholds.js
// Recomputes τ* and stratified thresholds given empirical α, β.
//
// Usage:
//   node test/recalibrate-thresholds.js --alpha 1 --beta 10 --gamma 10
//
// Output: thresholds for global and per-class, and check if τ* shifted >0.05.

const { computePosteriorMean } = require('../prover/scorer');

// ---------------------------------------------------------------------------
// Simulation parameters
// ---------------------------------------------------------------------------
const MONTE_CARLO_CYCLES = 10000;

// Simulate a poll cycle: given true state (valid/invalid) and number of honest gateways,
// return (mismatches, totalResponded) based on gateway reliability.
function simulateCycle(trueState, totalGateways, honestReliability, compromisedCount) {
  const total = totalGateways;
  const honest = total - compromisedCount;
  let mismatches = 0;
  let responded = 0;

  for (let i = 0; i < total; i++) {
    const isCompromised = i < compromisedCount;
    const isHonest = !isCompromised;

    // Gateway responds with some reliability (honest 99.9%, compromised always responds)
    const responds = isHonest ? Math.random() < honestReliability : true;
    if (!responds) continue;
    responded++;

    if (isHonest) {
      // Honest gateway: if trueState is invalid, it reports mismatch (almost always)
      // if trueState is valid, it reports match (almost always)
      if (trueState === 'invalid') {
        mismatches += Math.random() < honestReliability ? 1 : 0;
      } else {
        mismatches += Math.random() < (1 - honestReliability) ? 1 : 0; // false mismatch
      }
    } else {
      // Compromised: always reports match regardless of true state
      // So for invalid state, it suppresses detection.
    }
  }
  return { mismatches, totalResponded: responded };
}

// Compute trigger score for a given (mismatches, responded) with α, β
function score(mismatches, responded, alpha, beta) {
  if (responded === 0) return 0;
  return (alpha + mismatches) / (alpha + beta + responded);
}

// Evaluate a threshold τ over a set of simulations, returning FPR and TPR
function evaluateThreshold(simulations, tau, alpha, beta, gamma) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const sim of simulations) {
    const s = score(sim.mismatches, sim.responded, alpha, beta);
    const trip = s >= tau;
    if (sim.trueState === 'invalid') {
      if (trip) tp++;
      else fn++;
    } else {
      if (trip) fp++;
      else tn++;
    }
  }
  const tpr = tp / (tp + fn) || 0;
  const fpr = fp / (fp + tn) || 0;
  const loss = gamma * (1 - tpr) + fpr;
  return { tpr, fpr, tau, loss };
}

// Find optimal τ given γ
function findOptimalTau(simulations, alpha, beta, gamma, step = 0.001) {
  let bestTau = 0;
  let bestLoss = Infinity;
  for (let tau = 0.01; tau <= 0.99; tau += step) {
    const { loss } = evaluateThreshold(simulations, tau, alpha, beta, gamma);
    if (loss < bestLoss) {
      bestLoss = loss;
      bestTau = tau;
    }
  }
  return { tau: bestTau, loss: bestLoss };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const params = { alpha: 1, beta: 10, gamma: 10 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--alpha') params.alpha = parseFloat(args[++i]);
    else if (args[i] === '--beta') params.beta = parseFloat(args[++i]);
    else if (args[i] === '--gamma') params.gamma = parseFloat(args[++i]);
  }
  return params;
}

const { alpha, beta, gamma } = parseArgs();
console.log(`Recalibrating with α=${alpha}, β=${beta}, γ=${gamma}`);
console.log(`Monte Carlo cycles: ${MONTE_CARLO_CYCLES}\n`);

// Generate simulations for both true states
const totalGateways = 5;
const honestReliability = 0.95;
const simulations = [];

for (let i = 0; i < MONTE_CARLO_CYCLES; i++) {
  // True state: half valid, half invalid (balanced)
  const trueState = i < MONTE_CARLO_CYCLES / 2 ? 'valid' : 'invalid';
  // No compromised gateways for calibration (clean test)
  const { mismatches, totalResponded } = simulateCycle(trueState, totalGateways, honestReliability, 0);
  simulations.push({ trueState, mismatches, totalResponded });
}

// Find optimal global τ*
const globalOpt = findOptimalTau(simulations, alpha, beta, gamma);

console.log(`Global optimal τ* = ${globalOpt.tau.toFixed(3)} (loss = ${globalOpt.loss.toFixed(4)})`);

// Check shift from previous 0.355
const shift = Math.abs(globalOpt.tau - 0.355);
console.log(`Shift from previous τ* = ${shift.toFixed(3)}`);
if (shift > 0.05) {
  console.log(`WARNING: Shift > 0.05. Threshold recalibration required.`);
} else {
  console.log(`Shift ≤ 0.05. Threshold stable.`);
}

// Compute per-class thresholds using separate simulation populations
// Class A: exactly 1 mismatch (weak evidence)
const simsA = [];
for (let i = 0; i < MONTE_CARLO_CYCLES; i++) {
  const trueState = i < MONTE_CARLO_CYCLES / 2 ? 'valid' : 'invalid';
  simsA.push({ trueState, mismatches: 1, totalResponded: 5 }); // Force 1 mismatch, 5 responded
}
const tauA = findOptimalTau(simsA, alpha, beta, gamma).tau;

// Class B: 2 or more mismatches (strong evidence)
const simsB = [];
for (let i = 0; i < MONTE_CARLO_CYCLES; i++) {
  const trueState = i < MONTE_CARLO_CYCLES / 2 ? 'valid' : 'invalid';
  const mismatches = Math.random() < 0.5 ? 2 : 3; // 2 or 3
  simsB.push({ trueState, mismatches, totalResponded: 5 });
}
const tauB = findOptimalTau(simsB, alpha, beta, gamma).tau;

console.log(`\nStratified thresholds (approximate):`);
console.log(`  τ_A (γ=1): ${tauA.toFixed(3)}`);
console.log(`  τ_B (γ=10): ${tauB.toFixed(3)}`);

// Suggest update to config
console.log(`\nIf these values are acceptable, update config/scoring.json:`);
console.log(`  "priorAlpha": ${alpha},`);
console.log(`  "priorBeta": ${beta},`);
console.log(`  "thresholdA": ${tauA.toFixed(3)},`);
console.log(`  "thresholdB": ${tauB.toFixed(3)}`);