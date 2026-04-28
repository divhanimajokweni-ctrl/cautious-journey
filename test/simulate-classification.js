// test/simulate-classification.js
// Simulates ROC curve for trigger score threshold calibration.
//
// Runs Monte Carlo simulations to estimate TPR and FPR across thresholds.
// Assumes Beta-Binomial model with α0=1, β0=10.
//
// Simulation parameters:
// - N = 10,000 poll cycles
// - P(H_t=1) = 0.01 (prior belief in tampering)
// - When H_t=1, θ = 0.5 (50% chance per gateway to detect mismatch)
// - When H_t=0, θ = 0 (no false mismatches)
// - r_t = 5 (fixed for simplicity, representing 5 responding gateways)
//
// Outputs ROC data to console and generates demo/roc-report.md

const fs = require('fs');
const path = require('path');

const { ALPHA0, BETA0 } = require('../prover/scorer');

const N_SIMULATIONS = 10000;
const P_DIVERGENCE = 0.01; // P(H_t=1)
const THETA_DIVERGENCE = 0.5; // Probability of detecting mismatch when H_t=1
const THETA_VALID = 0; // No mismatches when valid
const R_T = 5; // Responding gateways

function binomialSample(n, p) {
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (Math.random() < p) successes++;
  }
  return successes;
}

function simulatePollCycle() {
  const H_t = Math.random() < P_DIVERGENCE ? 1 : 0;
  const theta = H_t === 1 ? THETA_DIVERGENCE : THETA_VALID;
  const m_t = binomialSample(R_T, theta);
  const tau_t = (ALPHA0 + m_t) / (ALPHA0 + BETA0 + R_T);
  return { H_t, tau_t };
}

function computeROC(thresholds) {
  const roc = thresholds.map(tau => {
    let TP = 0, FP = 0, TN = 0, FN = 0;
    for (let i = 0; i < N_SIMULATIONS; i++) {
      const { H_t, tau_t } = simulatePollCycle();
      const decision = tau_t >= tau ? 1 : 0; // Trip if >= tau
      if (H_t === 1 && decision === 1) TP++;
      else if (H_t === 0 && decision === 1) FP++;
      else if (H_t === 0 && decision === 0) TN++;
      else if (H_t === 1 && decision === 0) FN++;
    }
    const TPR = TP / (TP + FN) || 0;
    const FPR = FP / (FP + TN) || 0;
    return { tau, TPR, FPR, TP, FP, TN, FN };
  });
  return roc;
}

function findOptimalThreshold(roc, costRatio = 100, pValid = 0.99, pInvalid = 0.01) {
  // Slope dTPR/dFPR = (c1/c2) * (P(H=0)/P(H=1))
  const targetSlope = (1 / costRatio) * (pValid / pInvalid);
  let bestTau = 0;
  let minDiff = Infinity;
  for (let i = 1; i < roc.length; i++) {
    const prev = roc[i-1];
    const curr = roc[i];
    const slope = (curr.TPR - prev.TPR) / (curr.FPR - prev.FPR) || 0;
    const diff = Math.abs(slope - targetSlope);
    if (diff < minDiff) {
      minDiff = diff;
      bestTau = curr.tau;
    }
  }
  return bestTau;
}

function generateReport(roc, optimalTau) {
  let report = `# ROC Calibration Report for Trigger Score Threshold\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Simulation Parameters\n\n`;
  report += `- N = ${N_SIMULATIONS} poll cycles\n`;
  report += `- P(H_t=1) = ${P_DIVERGENCE}\n`;
  report += `- θ (divergence) = ${THETA_DIVERGENCE}\n`;
  report += `- θ (valid) = ${THETA_VALID}\n`;
  report += `- r_t = ${R_T} responding gateways\n`;
  report += `- Prior: Beta(${ALPHA0}, ${BETA0})\n\n`;

  report += `## ROC Data\n\n`;
  report += `| Threshold (τ) | TPR | FPR |\n`;
  report += `|---------------|-----|-----|\n`;
  roc.forEach(point => {
    report += `| ${point.tau.toFixed(3)} | ${point.TPR.toFixed(3)} | ${point.FPR.toFixed(3)} |\n`;
  });
  report += `\n`;

  report += `## Optimal Threshold\n\n`;
  report += `Chosen τ* = ${optimalTau.toFixed(3)}\n\n`;
  report += `Based on cost ratio ρ = c2/c1 = 100 (safety-first posture).\n\n`;
  report += `This threshold minimizes expected loss under conservative assumptions.\n\n`;

  const reportPath = path.join(__dirname, '..', 'demo', 'roc-report.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  console.log(`ROC report written to ${reportPath}`);
}

function main() {
  console.log('Running ROC simulation...');
  const thresholds = [];
  for (let i = 0; i <= 100; i++) {
    thresholds.push(i / 100);
  }
  const roc = computeROC(thresholds);
  const optimalTau = findOptimalThreshold(roc);
  console.log(`Optimal threshold: ${optimalTau.toFixed(3)}`);
  generateReport(roc, optimalTau);
}

if (require.main === module) {
  main();
}

module.exports = { simulatePollCycle, computeROC, findOptimalThreshold };