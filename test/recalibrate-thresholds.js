// test/recalibrate-thresholds.js
// ProofBridge Liner — Threshold Recalibration (patched)
//
// PATCH v1.1 — two fixes:
//   1. gamma scoping bug: evaluateThreshold now takes gamma as explicit parameter
//   2. stratified threshold derivation uses separate simulation populations
//      per scenario class (A/B), not the same population at different γ
//
// Usage:
//   node test/recalibrate-thresholds.js --alpha 1 --beta 10 --gamma 10
//
// Output: τ_A, τ_B, global τ*, shift from previous values

// ---------------------------------------------------------------------------
// Simulation parameters
// ---------------------------------------------------------------------------
const MONTE_CARLO_CYCLES = 10000;
const TOTAL_GATEWAYS = 5;
const HONEST_RELIABILITY = 0.999;

// ---------------------------------------------------------------------------
// Simulate one poll cycle
// Returns { mismatches, totalResponded }
// ---------------------------------------------------------------------------
function simulateCycle(trueState, totalGateways, honestReliability, compromisedCount) {
  const honest = totalGateways - compromisedCount;
  let mismatches = 0;
  let responded = 0;

  for (let i = 0; i < totalGateways; i++) {
    const isCompromised = i < compromisedCount;

    if (isCompromised) {
      // Compromised gateway always responds with match (suppresses detection)
      responded++;
      // Does NOT add a mismatch regardless of true state
    } else {
      // Honest gateway responds with honestReliability probability
      if (Math.random() >= honestReliability) continue;
      responded++;
      if (trueState === 'invalid') {
        // Honest gateway correctly reports mismatch with honestReliability probability
        if (Math.random() < honestReliability) mismatches++;
      } else {
        // Valid document: honest gateway produces false mismatch with (1-reliability) probability
        if (Math.random() >= honestReliability) mismatches++;
      }
    }
  }
  return { mismatches, totalResponded: responded };
}

// ---------------------------------------------------------------------------
// Compute trigger score (Beta-Binomial posterior mean)
// PATCH: takes alpha, beta as explicit parameters
// ---------------------------------------------------------------------------
function score(mismatches, responded, alpha, beta) {
  if (responded === 0) return 0;
  return (alpha + mismatches) / (alpha + beta + responded);
}

// ---------------------------------------------------------------------------
// Evaluate threshold τ over a simulation set
// PATCH: gamma is now an EXPLICIT parameter — not captured from closure
// ---------------------------------------------------------------------------
function evaluateThreshold(simulations, tau, alpha, beta, gamma) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const sim of simulations) {
    const s = score(sim.mismatches, sim.totalResponded, alpha, beta);
    const trip = s >= tau;
    if (sim.trueState === 'invalid') {
      trip ? tp++ : fn++;
    } else {
      trip ? fp++ : tn++;
    }
  }
  const tpr = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const fpr = (fp + tn) > 0 ? fp / (fp + tn) : 0;
  const loss = gamma * (1 - tpr) + fpr;
  return { tpr, fpr, tau, loss };
}

// ---------------------------------------------------------------------------
// Find optimal τ for a given simulation set and gamma
// PATCH: passes gamma explicitly through to evaluateThreshold
// ---------------------------------------------------------------------------
function findOptimalTau(simulations, alpha, beta, gamma, step = 0.001) {
  let bestTau = 0.5;
  let bestLoss = Infinity;
  for (let tau = 0.01; tau <= 0.99; tau += step) {
    const { loss } = evaluateThreshold(simulations, tau, alpha, beta, gamma);
    if (loss < bestLoss) {
      bestLoss = loss;
      bestTau = Math.round(tau * 1000) / 1000; // avoid float drift
    }
  }
  return { tau: bestTau, loss: bestLoss };
}

// ---------------------------------------------------------------------------
// PATCH: Build scenario-stratified simulation populations
//
// Class A: weak evidence — exactly 1 mismatch from a single gateway
//   Simulates: trueState=invalid, 1 honest gateway reports mismatch,
//              others report match (or are compromised)
//   γ_A: use the provided gamma (same cost ratio — the difference in τ
//        emerges from the evidence, not from changing the cost assumption)
//
// Class B: strong evidence — ≥2 gateways reporting consistent mismatch
//   Simulates: trueState=invalid, ≥2 honest gateways report mismatch
//
// Global: balanced mix of valid and invalid, clean gateways
// ---------------------------------------------------------------------------
function buildSimulations(compromisedCount = 0) {
  const global = [];
  const classA = [];   // weak evidence: single mismatch
  const classB = [];   // strong evidence: multi-mismatch

  for (let i = 0; i < MONTE_CARLO_CYCLES; i++) {
    const trueState = i < MONTE_CARLO_CYCLES / 2 ? 'valid' : 'invalid';
    const sim = simulateCycle(trueState, TOTAL_GATEWAYS, HONEST_RELIABILITY, compromisedCount);
    global.push({ trueState, ...sim });

    // Class A population: invalid cases where exactly 1 mismatch was observed
    if (trueState === 'invalid' || trueState === 'valid') {
      const classASim = simulateCycle(trueState, TOTAL_GATEWAYS, HONEST_RELIABILITY, compromisedCount);
      // Clamp to class A definition: ≤1 mismatch
      if (classASim.mismatches <= 1 && classASim.totalResponded >= 2) {
        classA.push({ trueState, ...classASim });
      }

      // Class B population: ≥2 mismatches from ≥2 responders
      const classBSim = simulateCycle(trueState, TOTAL_GATEWAYS, HONEST_RELIABILITY, compromisedCount);
      if (classBSim.mismatches >= 2 && classBSim.totalResponded >= 2) {
        classB.push({ trueState, ...classBSim });
      }
    }
  }

  return { global, classA, classB };
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
const PREVIOUS_TAU_B = 0.355;
const PREVIOUS_TAU_A = 0.60;

console.log('=== ProofBridge Threshold Recalibration ===\n');
console.log(`Parameters: α=${alpha}, β=${beta}, γ=${gamma}`);
console.log(`Monte Carlo cycles: ${MONTE_CARLO_CYCLES}`);
console.log(`Gateways: ${TOTAL_GATEWAYS}, reliability: ${HONEST_RELIABILITY}\n`);

console.log('Building simulation populations...');
const { global: globalSims, classA: classASims, classB: classBSims } = buildSimulations(0);

console.log(`  Global population:  ${globalSims.length} simulations`);
console.log(`  Class A population: ${classASims.length} simulations (≤1 mismatch, ≥2 responders)`);
console.log(`  Class B population: ${classBSims.length} simulations (≥2 mismatches, ≥2 responders)\n`);

if (classASims.length < 100 || classBSims.length < 100) {
  console.warn('WARNING: Small class population. Increase MONTE_CARLO_CYCLES for reliable calibration.');
}

// Global τ* at specified gamma
const globalOpt = findOptimalTau(globalSims, alpha, beta, gamma);
console.log(`Global τ* = ${globalOpt.tau.toFixed(3)} (loss = ${globalOpt.loss.toFixed(4)})`);

const globalShift = Math.abs(globalOpt.tau - PREVIOUS_TAU_B);
console.log(`Shift from previous τ_B (${PREVIOUS_TAU_B}): ${globalShift.toFixed(3)}`);
if (globalShift > 0.05) {
  console.log('⚠  SHIFT > 0.05 — threshold recalibration required');
} else {
  console.log('✓  Shift ≤ 0.05 — threshold stable');
}

// PATCH: Class A threshold from class A population at SAME gamma
// τ_A > τ_B should emerge naturally because class A has weaker evidence
const classAOpt = findOptimalTau(classASims, alpha, beta, gamma);
const classAShift = Math.abs(classAOpt.tau - PREVIOUS_TAU_A);
console.log(`\nClass A τ_A = ${classAOpt.tau.toFixed(3)} (from weak-evidence population, γ=${gamma})`);
console.log(`Shift from previous τ_A (${PREVIOUS_TAU_A}): ${classAShift.toFixed(3)}`);
if (classAShift > 0.05) {
  console.log('⚠  SHIFT > 0.05 — τ_A recalibration required');
} else {
  console.log('✓  τ_A stable');
}

// Class B threshold from class B population
const classBOpt = findOptimalTau(classBSims, alpha, beta, gamma);
console.log(`\nClass B τ_B = ${classBOpt.tau.toFixed(3)} (from strong-evidence population, γ=${gamma})`);

// Analytical sanity check: τ_A should be ≥ τ_B
if (classAOpt.tau < classBOpt.tau) {
  console.warn('\n⚠  ANALYTICAL WARNING: τ_A < τ_B. Weak evidence is being treated as stricter than strong evidence.');
  console.warn('   This is counter-intuitive. Check simulation populations for class contamination.');
} else {
  console.log('\n✓  Ordering check passed: τ_A ≥ τ_B (weak evidence requires higher posterior to trip)');
}

// Suggest config update
console.log('\n=== Suggested config/scoring.json update ===\n');
console.log(JSON.stringify({
  priorAlpha: alpha,
  priorBeta: beta,
  thresholdA: parseFloat(classAOpt.tau.toFixed(3)),
  thresholdB: parseFloat(classBOpt.tau.toFixed(3)),
  minMismatchesB: 2,
  minGatewaysB: 2,
  _calibratedAt: new Date().toISOString(),
  _gamma: gamma,
}, null, 2));