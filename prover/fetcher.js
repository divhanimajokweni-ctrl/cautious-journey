/**
 * prover/fetcher.js
 * ----------------------------------------------------------
 * Phase 3 component #1 of the off-chain prover.
 *
 * Responsibilities:
 *   1. Read config/assets.json -> [{ assetId, ipfsCid, expectedHash }]
 *   2. For each asset:
 *        a. Fetch the deed PDF from an IPFS gateway.
 *        b. Compute SHA-256 of the bytes.
 *        c. Compare against `expectedHash`.
 *        d. Emit a "ProofFresh" or "ProofMismatch" event for the
 *           submitter to relay on-chain.
 *
 * The fetcher is intentionally stateless. It is run on a cron
 * (every 5 minutes by default) and writes the latest result to
 * .local/state/prover-state.json so the dashboard can render it.
 *
 * Usage:
 *   node prover/fetcher.js               # one-shot
 *   node prover/fetcher.js --watch       # poll forever
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_PATH = path.join(ROOT, 'config', 'assets.json');
const STATE_DIR = path.join(ROOT, '.local', 'state');
const STATE_PATH = path.join(STATE_DIR, 'prover-state.json');

const { resolveCID, evaluateResolution } = require('./ipfsResolver');
const { scoreAsset } = require('./scorer');

const POLL_MS = Number(process.env.FETCHER_POLL_MS || 5 * 60 * 1000);

// Exponential backoff
function backoff(attempt, baseMs = 1000) {
  const delay = baseMs * Math.pow(2, attempt);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Structured logger
function logEvent(level, message, meta = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else console.log(output);
}

function loadAssets() {
  const raw = fs.readFileSync(ASSETS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('assets.json must be an array');
  return parsed;
}

function sha256(buf) {
  return '0x' + crypto.createHash('sha256').update(buf).digest('hex');
}

// Phase 4: Gateway Quorum Resolution
async function resolveWithQuorum(cid, expectedHash) {
  logEvent('info', 'Starting gateway quorum resolution', { cid });

  const results = await resolveCID(cid);
  const outcome = evaluateResolution(results, expectedHash);

  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);

  logEvent('info', 'Resolution complete', {
    cid,
    status: outcome.status,
    successes: successes.length,
    failures: failures.length,
    observedHash: outcome.observedHash
  });

  return {
    results,
    outcome,
    successes,
    failures
  };
}

async function checkAsset(asset, previousResult) {
  const start = Date.now();
  const result = {
    assetId: asset.assetId,
    ipfsCid: asset.ipfsCid,
    expectedHash: asset.expectedHash,
    actualHash: null,
    status: 'unknown',
    health: 'unknown',
    gateway: null,
    bytes: 0,
    error: null,
    durationMs: 0,
    checkedAt: new Date().toISOString(),
    consecutiveUnreachable: 0,
    // Phase 4 additions
    resolutionStatus: null,
    gatewayResults: [],
    evidence: null
  };

  try {
    const { results, outcome, successes, failures } = await resolveWithQuorum(asset.ipfsCid, asset.expectedHash);

    result.resolutionStatus = outcome.status;
    result.gatewayResults = results;
    const score = scoreAsset(results, asset.expectedHash);
    result.triggerScore = score.triggerScore;
    result.scenario = score.scenario;
    result.thresholdUsed = score.thresholdUsed;

    switch (outcome.status) {
      case 'CONSISTENT':
        result.actualHash = outcome.observedHash;
        result.status = 'fresh';
        result.health = failures.length === 0 ? 'healthy' : 'degraded';
        // Find first successful gateway for reporting
        const firstSuccess = successes[0];
        if (firstSuccess) {
          result.gateway = firstSuccess.gateway;
        }
        break;

      case 'HASH_MISMATCH':
        result.status = 'mismatch';
        result.health = 'compromised';
        result.evidence = outcome.evidence;
        logEvent('error', 'Hash mismatch detected', {
          assetId: asset.assetId,
          cid: asset.ipfsCid,
          evidence: outcome.evidence
        });
        break;

      case 'NETWORK_UNAVAILABLE':
        result.status = 'unreachable';
        result.error = 'all gateways failed';
        result.health = 'unreachable';
        logEvent('warn', 'Network unavailable', {
          assetId: asset.assetId,
          cid: asset.ipfsCid,
          failures: failures.length
        });
        break;
    }
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
    result.health = 'error';
    logEvent('error', 'Resolution failed', {
      assetId: asset.assetId,
      error: err.message
    });
  }

  result.durationMs = Date.now() - start;

  // Compute consecutive unreachables (updated for Phase 4)
  const prevCount = previousResult?.consecutiveUnreachable || 0;
  if (result.status === 'unreachable' || result.resolutionStatus === 'NETWORK_UNAVAILABLE') {
    result.consecutiveUnreachable = prevCount + 1;
  } else {
    result.consecutiveUnreachable = 0;
  }

  // Apply threshold for network unavailable
  const threshold = Number(process.env.MAX_UNREACHABLE_RETRIES || 3);
  if ((result.status === 'unreachable' || result.resolutionStatus === 'NETWORK_UNAVAILABLE') &&
      result.consecutiveUnreachable >= threshold) {
    result.status = 'unreachable_threshold';
  }

  return result;
}

function loadPreviousState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function persistState(results) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const payload = {
    runAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      fresh: results.filter((r) => r.status === 'fresh').length,
      mismatch: results.filter((r) => r.status === 'mismatch').length,
      unreachable: results.filter((r) => r.status === 'unreachable').length,
      unreachable_threshold: results.filter((r) => r.status === 'unreachable_threshold').length,
      // Phase 4 additions
      network_unavailable: results.filter((r) => r.resolutionStatus === 'NETWORK_UNAVAILABLE').length,
      hash_mismatch: results.filter((r) => r.resolutionStatus === 'HASH_MISMATCH').length,
      consistent: results.filter((r) => r.resolutionStatus === 'CONSISTENT').length,
    },
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

async function runOnce() {
  const assets = loadAssets();
  const previous = loadPreviousState();
  const previousResults = previous.results || [];
  const prevMap = {};
  for (const r of previousResults) {
    prevMap[r.assetId] = r;
  }
  console.log(`[fetcher] checking ${assets.length} asset(s)`);
  const results = [];
  for (const asset of assets) {
    const r = await checkAsset(asset, prevMap[asset.assetId]);
    results.push(r);
    console.log(
      `[fetcher] ${r.assetId}  status=${r.status}  ` +
        (r.actualHash ? `hash=${r.actualHash.slice(0, 14)}…  ` : '') +
        (r.consecutiveUnreachable ? `consec=${r.consecutiveUnreachable}  ` : '') +
        `(${r.durationMs}ms)`
    );
  }
  const payload = persistState(results);
  console.log(
    `[fetcher] summary  fresh=${payload.summary.fresh}  ` +
      `mismatch=${payload.summary.mismatch}  unreachable=${payload.summary.unreachable}  threshold=${payload.summary.unreachable_threshold}`
  );
  console.log(
    `[fetcher] Phase 4:  consistent=${payload.summary.consistent}  ` +
      `hash_mismatch=${payload.summary.hash_mismatch}  network_unavailable=${payload.summary.network_unavailable}`
  );
  return payload;
}

async function watch() {
  for (;;) {
    try {
      await runOnce();
    } catch (err) {
      console.error('[fetcher] run failed:', err.message || err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

if (require.main === module) {
  const watchMode = process.argv.includes('--watch');
  (watchMode ? watch() : runOnce()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runOnce, checkAsset, sha256, loadAssets, loadPreviousState };
