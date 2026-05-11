/**
 * test/haridev888-calibration-backtest.js
 * Haridev888 Historical Dataset Calibration Backtest
 *
 * Board-binding success conditions:
 *   - ≥99% recall on historical failures
 *   - Zero violations of physical invariants
 *   - Monotonic risk increase with worsening telemetry
 *
 * This backtest validates the calibrated Safegrid Brain against
 * the vv-monorepo fork (Row 405 Lean 4 theorem encoded).
 */

const fs = require('fs');
const path = require('path');
const { scoreAsset } = require('../prover/scorer');

const MANIFEST_PATH = path.resolve(__dirname, '..', '.local', 'state', 'haridev888-calibration-manifest.json');
const HISTORICAL_DATA_PATH = path.resolve(__dirname, 'haridev888', 'historical-failures.json');

// Physical invariants (must never be violated)
const PHYSICAL_INVARIANTS = {
  nonNegativeWindSpeed: (r) => r.telemetry.windSpeed >= 0,
  nonNegativeIrradiance: (r) => r.telemetry.irradiance >= 0,
  validTemperature: (r) => r.telemetry.temperature >= -50 && r.telemetry.temperature <= 100,
  reasonableVoltage: (r) => r.telemetry.voltage >= 0 && r.telemetry.voltage <= 500,
};

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}. Run DVC pipeline first.`);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function loadHistoricalDataset() {
  if (!fs.existsSync(HISTORICAL_DATA_PATH)) {
    throw new Error(`Historical dataset not found at ${HISTORICAL_DATA_PATH}. Clone & isolate first.`);
  }
  return JSON.parse(fs.readFileSync(HISTORICAL_DATA_PATH, 'utf8'));
}

function checkPhysicalInvariants(record) {
  const violations = [];
  for (const [name, predicate] of Object.entries(PHYSICAL_INVARIANTS)) {
    if (!predicate(record)) {
      violations.push(name);
    }
  }
  return violations;
}

function runBacktest(dataset, scorerConfig) {
  console.log('\n========== HARIDEV888 CALIBRATION BACKTEST ==========\n');
  console.log(`Dataset: ${dataset.metadata.source}`);
  console.log(`Total historical records: ${dataset.records.length}\n`);

  let truePositives = 0;
  let falseNegatives = 0;
  let physicalViolations = 0;
  const riskScores = [];

  // Group by severity for monotonicity check
  const severityGroups = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };

  for (const record of dataset.records) {
    // Check physical invariants FIRST (non-negotiable)
    const violations = checkPhysicalInvariants(record);
    if (violations.length > 0) {
      physicalViolations++;
      console.error(`[VIOLATION] Record ${record.id} violated: ${violations.join(', ')}`);
      continue; // Skip scoring for invariant-violating records
    }

    // Score with calibrated Safegrid Brain
    const gatewayResults = record.gatewayResults; // Array of {gateway, ok, hash}
    const expectedHash = record.expectedHash;

    const score = scoreAsset(gatewayResults, expectedHash);
    riskScores.push({ id: record.id, score: score.triggerScore, severity: record.severity });

    // Record by severity bucket
    if (record.severity) {
      severityGroups[record.severity].push(score.triggerScore);
    }

    // Recall determination:
    // Historical failures are labeled with 'shouldTrip: true'
    // We recall if score.trip === true for those records
    const shouldTrip = record.shouldTrip;

    if (shouldTrip && score.trip) {
      truePositives++;
    } else if (shouldTrip && !score.trip) {
      falseNegatives++;
    }
  }

  const recall = truePositives / (truePositives + falseNegatives);
  const totalTested = truePositives + falseNegatives;

  console.log('--- Recall on Historical Failures ---');
  console.log(`True Positives: ${truePositives}`);
  console.log(`False Negatives: ${falseNegatives}`);
  console.log(`Total tested: ${totalTested}`);
  console.log(`Recall: ${(recall * 100).toFixed(2)}%`);
  console.log(`Board threshold: ≥99%`);

  console.log('\n--- Physical Invariant Check ---');
  console.log(`Violations found: ${physicalViolations}`);
  console.log(`Board threshold: 0`);

  console.log('\n--- Monotonic Risk Verification ---');
  let monotonic = true;
  // MONOTONIC: risk should increase with worsening severity
  // Order: low -> medium -> high -> critical
  const severityOrder = ['low', 'medium', 'high', 'critical'];
  let prevAvg = -1;

  for (const severity of severityOrder) {
    const scores = severityGroups[severity];
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  ${severity.toUpperCase()}: avg=${avg.toFixed(4)} (n=${scores.length})`);

    if (avg < prevAvg) {
      console.error(`  ✗ Monotonicity violation: ${severity} avg (${avg.toFixed(4)}) < ${prevAvg.toFixed(4)}`);
      monotonic = false;
    }
    prevAvg = avg;
  }
  console.log(`Monotonic: ${monotonic ? '✓ PASS' : '✗ FAIL'}`);

  // Final verdict
  console.log('\n========== BOARD SUCCESS CRITERIA ==========');
  const recallPass = recall >= 0.99;
  const invariantPass = physicalViolations === 0;
  const monotonicPass = monotonic;

  console.log(`Recall ≥99%:        ${recallPass ? '✓ PASS' : '✗ FAIL'} (${(recall*100).toFixed(2)}%)`);
  console.log(`Zero violations:    ${invariantPass ? '✓ PASS' : '✗ FAIL'} (${physicalViolations} violations)`);
  console.log(`Monotonic risk:     ${monotonicPass ? '✓ PASS' : '✗ FAIL'}`);

  const allPass = recallPass && invariantPass && monotonicPass;
  console.log(`\nOVERALL: ${allPass ? '✓ CALIBRATION APPROVED' : '✗ CALIBRATION REJECTED'}`);

  if (!allPass) {
    console.error('\nBoard directive: AUTOMATIC HALT — NO REDEPLOY');
    process.exit(1);
  }

  console.log('\nCalibration backtest complete — all board conditions satisfied.');
  return {
    recall,
    physicalViolations,
    monotonic,
    scorerConfig: scorerConfig
  };
}

// Main execution
function main() {
  try {
    const manifest = loadManifest();
    console.log(`[haridev888] Loaded manifest for dataset: ${manifest.dataset}`);
    console.log(`[haridev888] Fork commit: ${manifest.commit_hash}`);

    const dataset = loadHistoricalDataset();
    const scorerConfig = require('../config/scoring.json');

    const result = runBacktest(dataset, scorerConfig);

    // Write backtest results for board
    const resultsPath = path.resolve(__dirname, '.local', 'state', 'haridev888-backtest-results.json');
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      dataset: manifest.dataset,
      commit_hash: manifest.commit_hash,
      board_criteria: {
        recall_threshold: 0.99,
        physical_violations_threshold: 0,
        monotonic_risk: true
      },
      results: result,
      approved: true
    }, null, 2));

    console.log(`\n[haridev888] Results saved to ${resultsPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`[haridev888] Backtest failed: ${err.message}`);
    console.error('[haridev888] Board directive: AUTOMATIC HALT');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runBacktest, checkPhysicalInvariants };
