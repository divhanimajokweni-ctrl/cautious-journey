#!/usr/bin/env node
// test/diagnose-cid.js
// ProofBridge Liner — CID Diagnostic Tool
//
// Diagnoses why calibrate-prior.js produced μ=1.0.
// Manually fetches the calibration CID from each gateway,
// computes SHA-256, and compares against expected hash
// with explicit hex normalisation to catch encoding mismatches.
//
// Usage:
//   node test/diagnose-cid.js
//
// Exit codes:
//   0 — all gateways match, CID is stable, harness bug suspected
//   1 — CID is unreachable or hash mismatches on all gateways
//   2 — mixed results (partial gateway failure)

const https = require('node:https');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// The exact values from the calibration harness
// ---------------------------------------------------------------------------
const CID = 'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354';
const EXPECTED_HASH_RAW = '0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed';

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

// ---------------------------------------------------------------------------
// Normalise hex strings for comparison
// Handles: with/without 0x prefix, uppercase/lowercase
// ---------------------------------------------------------------------------
function normaliseHex(h) {
  if (!h) return '';
  return h.toLowerCase().replace(/^0x/, '');
}

// ---------------------------------------------------------------------------
// Fetch with redirect support and 15s timeout
// ---------------------------------------------------------------------------
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Main diagnostic
// ---------------------------------------------------------------------------
async function diagnose() {
  console.log('=== ProofBridge CID Diagnostic ===\n');
  console.log(`CID:           ${CID}`);
  console.log(`Expected hash: ${EXPECTED_HASH_RAW}`);
  console.log(`Normalised:    ${normaliseHex(EXPECTED_HASH_RAW)}\n`);

  const results = [];

  for (const gateway of GATEWAYS) {
    const url = gateway + CID;
    process.stdout.write(`Fetching from ${gateway} ... `);
    try {
      const buf = await httpGet(url);
      const rawHash = sha256hex(buf);           // no 0x prefix, lowercase
      const normExpected = normaliseHex(EXPECTED_HASH_RAW);
      const match = rawHash === normExpected;

      console.log(match ? '✓ MATCH' : '✗ MISMATCH');
      console.log(`  Bytes received:  ${buf.length}`);
      console.log(`  Computed hash:   ${rawHash}`);
      console.log(`  Expected hash:   ${normExpected}`);
      if (!match) {
        console.log(`  FIRST DIFF at byte: ${firstDiff(rawHash, normExpected)}`);
      }
      results.push({ gateway, status: match ? 'match' : 'mismatch', hash: rawHash, bytes: buf.length });
    } catch (err) {
      console.log(`✗ UNREACHABLE`);
      console.log(`  Error: ${err.message}`);
      results.push({ gateway, status: 'unreachable', error: err.message });
    }
    console.log('');
  }

  // ---------------------------------------------------------------------------
  // Diagnosis
  // ---------------------------------------------------------------------------
  const matches = results.filter(r => r.status === 'match');
  const mismatches = results.filter(r => r.status === 'mismatch');
  const unreachable = results.filter(r => r.status === 'unreachable');

  console.log('=== Diagnosis ===\n');

  if (matches.length === GATEWAYS.length) {
    console.log('RESULT: All gateways match expected hash.');
    console.log('CAUSE:  CID is stable. The μ=1.0 was caused by a bug in the calibration harness.');
    console.log('ACTION: Inspect hash comparison logic in test/calibrate-prior.js.');
    console.log('        Check for 0x prefix mismatch: sha256() returns without 0x,');
    console.log('        but expectedHash in TEST_ASSET includes 0x prefix.');
    console.log('        Fix: normalise both sides before comparison.\n');
    process.exit(0);
  }

  if (unreachable.length === GATEWAYS.length) {
    console.log('RESULT: All gateways unreachable.');
    console.log('CAUSE:  Network issue or CID no longer pinned.');
    console.log('ACTION: Check network connectivity. Try fetching CID manually in browser.');
    console.log('        If unpinned, select a new stable CID for calibration.\n');
    process.exit(1);
  }

  if (mismatches.length > 0 && unreachable.length === 0) {
    console.log('RESULT: CID reachable but hash does not match expected value.');
    console.log('CAUSE:  Document at this CID has changed, or expected hash in fixture is wrong.');

    // Show what the actual hash is
    const actualHash = mismatches[0].hash;
    console.log(`\nActual hash:   ${actualHash}`);
    console.log(`Expected hash: ${normaliseHex(EXPECTED_HASH_RAW)}`);
    console.log('\nACTION: If the actual hash above is the correct baseline,');
    console.log('        update TEST_ASSET.expectedHash in test/calibrate-prior.js to:');
    console.log(`        "0x${actualHash}"`);
    console.log('        Then re-run the calibration harness.\n');
    process.exit(1);
  }

  // Mixed
  console.log('RESULT: Mixed — some gateways reachable, some not.');
  console.log(`  Match:       ${matches.length}`);
  console.log(`  Mismatch:    ${mismatches.length}`);
  console.log(`  Unreachable: ${unreachable.length}`);
  console.log('\nACTION: Gateway instability. Wait 10 minutes and re-run diagnostic.');
  console.log('        If persistent, replace failing gateways in GATEWAYS list.\n');
  process.exit(2);
}

function firstDiff(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return i;
  }
  return Math.min(a.length, b.length);
}

diagnose().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});