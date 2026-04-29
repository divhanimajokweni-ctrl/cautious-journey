// test/calibrate-prior.js
// Empirical calibration harness for Beta-Binomial prior parameters.
//
// Runs consecutive fetch cycles against a known-valid document to estimate
// the false mismatch rate μ. Then recommends α, β for a given prior strength S.
//
// Usage:
//   node test/calibrate-prior.js --cycles 100 --strength 10
//
// Outputs:
//   - Observed μ (false mismatch rate)
//   - Recommended α, β for prior strength S
//   - Raw data saved to test/calibration-data.json

const fs = require('fs');
const path = require('path');
const { resolveCID, sha256 } = require('../prover/ipfsResolver');

const CYCLES = process.argv.includes('--cycles') ? parseInt(process.argv[process.argv.indexOf('--cycles') + 1]) : 100;
const STRENGTH = process.argv.includes('--strength') ? parseInt(process.argv[process.argv.indexOf('--strength') + 1]) : 10;

// Known-valid calibration asset
const CALIBRATION_ASSET = {
  cid: process.env.TARGET_CID || 'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
  expectedHash: process.env.TARGET_HASH || '0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed',
};

if (!CALIBRATION_ASSET.cid || !CALIBRATION_ASSET.expectedHash) {
  throw new Error("Missing TARGET_CID or TARGET_HASH");
}

async function runCalibration() {
  console.log('[calibrate] Starting calibration...');
  console.log(`[calibrate] Asset: Calibration asset — known valid`);
  console.log(`[calibrate] CID: ${CALIBRATION_ASSET.cid}`);
  console.log(`[calibrate] Expected hash: ${CALIBRATION_ASSET.expectedHash}`);

  const rawData = [];
  let totalResponses = 0;
  let totalMismatches = 0;
  let totalUnreachables = 0;

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`[calibrate] Cycle ${cycle}/${CYCLES}...`);
    const results = await resolveCID(CALIBRATION_ASSET.cid);
    // Take first 3 gateways
    const sampleResults = results.slice(0, 3);

    const cycleData = { cycle, results: [] };
    for (const r of sampleResults) {
      const status = r.ok ? (r.hash === CALIBRATION_ASSET.expectedHash ? 'match' : 'mismatch') : 'unreachable';
      cycleData.results.push({ gateway: r.gateway, status });
      if (status === 'mismatch') totalMismatches++;
      if (status === 'unreachable') totalUnreachables++;
      if (status !== 'unreachable') totalResponses++;
    }
    rawData.push(cycleData);
  }

  // Save raw data
  const dataPath = path.resolve(__dirname, 'calibration-data.json');
  fs.writeFileSync(dataPath, JSON.stringify({
    calibrationAsset: CALIBRATION_ASSET,
    cycles: CYCLES,
    rawData,
    totalMatches: totalResponses - totalMismatches,
    totalMismatches,
    totalUnreachable: totalUnreachables
  }, null, 2));
  console.log(`[calibrate] Raw data saved to ${dataPath}`);

  // Compute observed false mismatch rate μ
  const mu = totalResponses > 0 ? totalMismatches / totalResponses : 0;
  const unreachableRate = (CYCLES * 3) > 0 ? totalUnreachables / (CYCLES * 3) : 0;

  console.log(`[calibrate] Observed false mismatch rate: ${mu.toFixed(4)} (${totalMismatches} mismatches / ${totalResponses} responses)`);
  console.log(`[calibrate] Unreachable: ${totalUnreachables} (${unreachableRate.toFixed(4)}%)`);

  // Recommend prior for strength S
  const alpha = 1;
  const beta = STRENGTH;

  console.log(`[calibrate] Recommended prior for strength S=${STRENGTH}:`);
  console.log(`  α = ${alpha}, β = ${beta}`);
  console.log(`  → Beta(${alpha}, ${beta}), mean ≈ ${(alpha / (alpha + beta)).toFixed(4)}`);

  console.log(`[calibrate] To apply this prior, update config/scoring.json:`);
  console.log(`  "priorAlpha": ${alpha},`);
  console.log(`  "priorBeta": ${beta}`);

  // Alternative strengths
  console.log(`[calibrate] Alternative strengths for reference:`);
  for (const s of [5, 20, 50]) {
    const altBeta = s;
    const altMean = (alpha / (alpha + altBeta)).toFixed(4);
    console.log(`  S=${s}: α=${alpha}, β=${altBeta}, mean=${altMean}`);
  }
}

runCalibration().catch(console.error);