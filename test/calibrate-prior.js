// test/calibrate-prior.js
// ProofBridge Liner — Prior Calibration Harness (patched)
//
// PATCH v1.1 — fixes μ=1.0 false result caused by 0x prefix mismatch
// in hash comparison. Both computed and expected hashes are now normalised
// (lowercase, no 0x prefix) before comparison.
//
// Runs N fetcher cycles against a known-valid document,
// collects per-gateway match/mismatch/unreachable results,
// and computes recommended prior parameters for the
// Beta-Binomial scorer.
//
// Usage:
//   node test/calibrate-prior.js [--cycles 100] [--strength 10]
//
// Output:
//   test/calibration-data.json   raw per-cycle results
//   Console: recommended α, β for chosen prior strength
//
// IMPORTANT: Before running, verify CID and expectedHash are correct
// by running: node test/diagnose-cid.js

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEFAULT_CYCLES = 100;
const DEFAULT_STRENGTH = 10;

// Gate guard: refuse to run with placeholder values
const PLACEHOLDER_CID = 'bafybeihf3fh2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2f3g2';
const PLACEHOLDER_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const TEST_ASSET = {
  assetId: 'calibration-test-asset',
  cid: 'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
  expectedHash: '0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed',
  label: 'Calibration asset — known valid (test fixture)'
};

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

const CALIBRATION_DATA_FILE = path.resolve(__dirname, 'calibration-data.json');

// ---------------------------------------------------------------------------
// PATCH: Normalise hex strings before comparison
// Fixes: sha256() returns hex without 0x prefix
//        expectedHash may include 0x prefix
//        Previously: '0x182...' !== '182...' → always mismatch → μ=1.0
// ---------------------------------------------------------------------------
function normaliseHex(h) {
  if (!h) return '';
  return h.toLowerCase().replace(/^0x/, '');
}

function sha256(buffer) {
  // Returns WITHOUT 0x prefix — normalise both sides on comparison
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Fetch with redirect support
// ---------------------------------------------------------------------------
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Single cycle: fetch from all gateways, return per-gateway result
// PATCH: normalise both hashes before comparison
// ---------------------------------------------------------------------------
async function checkOnce(cid, expectedHash) {
  const normExpected = normaliseHex(expectedHash);
  const results = [];

  for (const gateway of GATEWAYS) {
    try {
      const buf = await httpGet(gateway + cid);
      const hash = sha256(buf);                        // no 0x prefix
      const normHash = normaliseHex(hash);             // normalise anyway
      const status = (normHash === normExpected) ? 'match' : 'mismatch';
      results.push({ gateway, status, hash: normHash });
    } catch (err) {
      results.push({ gateway, status: 'unreachable', error: err.message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Abort guard: if first cycle produces all mismatches, diagnose before continuing
// ---------------------------------------------------------------------------
async function preflight(cid, expectedHash) {
  console.log('[calibrate] Running preflight check (1 cycle)...');
  const results = await checkOnce(cid, expectedHash);
  const allMismatch = results.every(r => r.status === 'mismatch');
  const allUnreachable = results.every(r => r.status === 'unreachable');

  if (allMismatch) {
    console.error('\n[calibrate] ABORT: All gateways returned mismatch on first cycle.');
    console.error('[calibrate] This indicates either:');
    console.error('  (a) the expected hash does not match the document at this CID, or');
    console.error('  (b) a hash comparison bug (run node test/diagnose-cid.js to identify).');
    console.error('[calibrate] Do NOT proceed — a μ=1.0 calibration will corrupt thresholds.');
    process.exit(1);
  }

  if (allUnreachable) {
    console.error('\n[calibrate] ABORT: All gateways unreachable. Check network or CID pinning.');
    process.exit(1);
  }

  console.log('[calibrate] Preflight passed. Proceeding with full calibration.\n');
}

// ---------------------------------------------------------------------------
// Main calibration loop
// ---------------------------------------------------------------------------
async function calibrate(options = {}) {
  const cycles = options.cycles || DEFAULT_CYCLES;
  const strength = options.strength || DEFAULT_STRENGTH;

  // Gate: refuse placeholders
  if (TEST_ASSET.cid === PLACEHOLDER_CID || TEST_ASSET.expectedHash === PLACEHOLDER_HASH) {
    console.error('[calibrate] ERROR: Placeholder CID/hash detected. Replace with real values.');
    process.exit(1);
  }

  console.log(`[calibrate] Starting ${cycles} calibration cycles...`);
  console.log(`[calibrate] Asset: ${TEST_ASSET.label}`);
  console.log(`[calibrate] CID: ${TEST_ASSET.cid}`);
  console.log(`[calibrate] Expected hash (normalised): ${normaliseHex(TEST_ASSET.expectedHash)}\n`);

  // Preflight before full run
  await preflight(TEST_ASSET.cid, TEST_ASSET.expectedHash);

  const allData = [];
  let totalMatches = 0;
  let totalMismatches = 0;
  let totalUnreachable = 0;

  for (let i = 1; i <= cycles; i++) {
    process.stdout.write(`\r[calibrate] Cycle ${i}/${cycles}...`);
    const results = await checkOnce(TEST_ASSET.cid, TEST_ASSET.expectedHash);
    const cycleData = {
      cycle: i,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        matches: results.filter(r => r.status === 'match').length,
        mismatches: results.filter(r => r.status === 'mismatch').length,
        unreachable: results.filter(r => r.status === 'unreachable').length,
      }
    };
    allData.push(cycleData);

    totalMatches += cycleData.summary.matches;
    totalMismatches += cycleData.summary.mismatches;
    totalUnreachable += cycleData.summary.unreachable;

    // Abort early if μ is trending toward 1.0 after first 10 cycles
    if (i === 10) {
      const earlyMu = totalMismatches / (totalMatches + totalMismatches);
      if (earlyMu > 0.5) {
        console.error(`\n\n[calibrate] ABORT: Early μ=${earlyMu.toFixed(3)} exceeds 0.5 after 10 cycles.`);
        console.error('[calibrate] CID may be unstable. Run node test/diagnose-cid.js.');
        process.exit(1);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n');

  // Save raw data
  const output = {
    testAsset: TEST_ASSET,
    patchVersion: '1.1',
    cyclesRequested: cycles,
    cyclesCompleted: allData.length,
    totalMatches,
    totalMismatches,
    totalUnreachable,
    cycles: allData,
  };
  fs.writeFileSync(CALIBRATION_DATA_FILE, JSON.stringify(output, null, 2));
  console.log(`[calibrate] Raw data saved to ${CALIBRATION_DATA_FILE}`);

  // Compute observed false mismatch rate
  const totalObservations = totalMatches + totalMismatches;
  if (totalObservations === 0) {
    console.log('[calibrate] No usable observations — all gateways unreachable.');
    return;
  }

  const mu = totalMismatches / totalObservations;
  console.log(`\n[calibrate] Observed false mismatch rate: ${mu.toFixed(4)} (${totalMismatches}/${totalObservations})`);
  console.log(`[calibrate] Unreachable: ${totalUnreachable} (${(totalUnreachable/(totalObservations+totalUnreachable)*100).toFixed(1)}%)`);

  // Gate: reject calibration if μ > 0.05
  if (mu > 0.05) {
    console.error(`\n[calibrate] WARNING: μ=${mu.toFixed(4)} exceeds 0.05 threshold.`);
    console.error('[calibrate] This CID is not suitable as a calibration baseline.');
    console.error('[calibrate] Prior parameters NOT updated. Select a more stable CID.');
    return;
  }

  // Recommend prior parameters
  const alpha = Math.max(Math.round(mu * strength), 1);
  const beta = Math.max(Math.round((1 - mu) * strength), 1);

  console.log(`\n[calibrate] Recommended prior for strength S=${strength}:`);
  console.log(`  α = ${alpha}, β = ${beta}`);
  console.log(`  → Beta(${alpha}, ${beta}), mean ≈ ${(alpha/(alpha+beta)).toFixed(4)}`);
  console.log(`\n[calibrate] Update config/scoring.json:`);
  console.log(`  "priorAlpha": ${alpha},`);
  console.log(`  "priorBeta": ${beta}`);

  console.log(`\n[calibrate] Alternative strengths for reference:`);
  [5, 20, 50].forEach(s => {
    const a = Math.max(Math.round(mu * s), 1);
    const b = Math.max(Math.round((1 - mu) * s), 1);
    console.log(`  S=${s}: α=${a}, β=${b}, mean=${(a/(a+b)).toFixed(4)}`);
  });

  return { mu, alpha, beta, totalObservations };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cycles' && i + 1 < args.length) {
      options.cycles = parseInt(args[i + 1], 10); i++;
    } else if (args[i] === '--strength' && i + 1 < args.length) {
      options.strength = parseInt(args[i + 1], 10); i++;
    }
  }
  return options;
}

const opts = parseArgs();
calibrate(opts)
  .then(() => { console.log('\n[calibrate] Done.'); process.exit(0); })
  .catch(err => { console.error(`\n[calibrate] Fatal: ${err.message}`); process.exit(1); });