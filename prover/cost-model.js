// prover/cost-model.js
// Stochastic economic model for ProofBridge Liner operational costs.
//
// Models monthly cost per asset as random variable:
// C = G * (c_u * N_u + c_t * N_t) + c_fixed
//
// Where:
// - G ~ Lognormal(μ_g, σ_g^2) : gas price fluctuations
// - N_u ~ Poisson(λ_u) : proof updates per month
// - N_t ~ Poisson(λ_t * FPR) : circuit trips per month
//
// Runs 10,000 Monte Carlo simulations to compute 95% CI.

const fs = require('fs');
const path = require('path');

// Parameters (conservative estimates)
const MU_G = Math.log(0.0002); // Mean gas cost per unit in USD (approx 50 gwei at $3000 ETH)
const SIGMA_G = 0.5; // Volatility
const C_U = 100000; // Gas units for updateProof
const C_T = 50000;  // Gas units for tripCircuit
const LAMBDA_U = 1; // Expected proof updates per month
const LAMBDA_T_BASE = 10; // Base trip rate (before FPR adjustment)
const FPR = 0.01; // False positive rate from calibration
const C_FIXED = 5; // Fixed cost per month in USD

const N_SIMULATIONS = 10000;

/**
 * Samples from lognormal distribution.
 * @param {number} mu - Mean of log
 * @param {number} sigma - SD of log
 * @returns {number}
 */
function lognormalSample(mu, sigma) {
  const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()); // Box-Muller
  return Math.exp(mu + sigma * z);
}

/**
 * Samples from Poisson distribution.
 * @param {number} lambda
 * @returns {number}
 */
function poissonSample(lambda) {
  if (lambda < 30) {
    // Knuth algorithm
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  } else {
    // Normal approximation
    const mean = lambda;
    const sd = Math.sqrt(lambda);
    return Math.round(Math.random() * sd * 2 + mean - sd);
  }
}

/**
 * Simulates one month's cost.
 * @returns {number} Total cost in USD
 */
function simulateMonthlyCost() {
  const G = lognormalSample(MU_G, SIGMA_G);
  const N_u = poissonSample(LAMBDA_U);
  const N_t = poissonSample(LAMBDA_T_BASE * FPR);
  const variableCost = G * (C_U * N_u + C_T * N_t);
  return variableCost + C_FIXED;
}

/**
 * Runs simulations and computes statistics.
 * @returns {Object} Cost statistics
 */
function computeCostStats() {
  const costs = [];
  for (let i = 0; i < N_SIMULATIONS; i++) {
    costs.push(simulateMonthlyCost());
  }
  costs.sort((a, b) => a - b);
  const mean = costs.reduce((a, b) => a + b, 0) / N_SIMULATIONS;
  const median = costs[Math.floor(N_SIMULATIONS / 2)];
  const ci95Low = costs[Math.floor(0.025 * N_SIMULATIONS)];
  const ci95High = costs[Math.floor(0.975 * N_SIMULATIONS)];
  return { mean, median, ci95Low, ci95High };
}

/**
 * Generates economic model report.
 * @param {Object} stats
 */
function generateReport(stats) {
  let report = `# Stochastic Economic Model for ProofBridge Liner\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Model Parameters\n\n`;
  report += `- Gas price: Lognormal(μ=${MU_G.toFixed(2)}, σ=${SIGMA_G})\n`;
  report += `- c_u = ${C_U} gas units (updateProof)\n`;
  report += `- c_t = ${C_T} gas units (tripCircuit)\n`;
  report += `- λ_u = ${LAMBDA_U} (expected updates/month)\n`;
  report += `- λ_t = ${LAMBDA_T_BASE} * FPR = ${(LAMBDA_T_BASE * FPR).toFixed(2)}\n`;
  report += `- FPR = ${FPR}\n`;
  report += `- c_fixed = $${C_FIXED}/month\n\n`;

  report += `## Monte Carlo Results (N=${N_SIMULATIONS})\n\n`;
  report += `- Mean monthly cost: $${stats.mean.toFixed(3)}\n`;
  report += `- Median monthly cost: $${stats.median.toFixed(3)}\n`;
  report += `- 95% CI: [$${stats.ci95Low.toFixed(3)}, $${stats.ci95High.toFixed(3)}]\n\n`;

  report += `## Conclusion\n\n`;
  report += `Under current Polygon gas conditions and conservative trip rate, the monthly operational cost per attested asset is **$${stats.mean.toFixed(3)} [${stats.ci95Low.toFixed(3)}, ${stats.ci95High.toFixed(3)}]** with 95% confidence.\n\n`;

  const reportPath = path.join(__dirname, '..', 'demo', 'economic-model.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  console.log(`Economic model report written to ${reportPath}`);
}

function main() {
  console.log('Running cost model simulations...');
  const stats = computeCostStats();
  console.log(`Mean cost: $${stats.mean.toFixed(3)}`);
  console.log(`95% CI: [$${stats.ci95Low.toFixed(3)}, $${stats.ci95High.toFixed(3)}]`);
  generateReport(stats);
}

if (require.main === module) {
  main();
}

module.exports = { simulateMonthlyCost, computeCostStats };