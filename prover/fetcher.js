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

const DEFAULT_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

const POLL_MS = Number(process.env.FETCHER_POLL_MS || 5 * 60 * 1000);

function loadAssets() {
  const raw = fs.readFileSync(ASSETS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('assets.json must be an array');
  return parsed;
}

function sha256(buf) {
  return '0x' + crypto.createHash('sha256').update(buf).digest('hex');
}

async function fetchFromGateways(cid, gateways) {
  let lastErr;
  for (const gw of gateways) {
    const url = gw.endsWith('/') ? gw + cid : `${gw}/${cid}`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${gw}`);
      const arr = new Uint8Array(await res.arrayBuffer());
      return { bytes: Buffer.from(arr), gateway: gw };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('all gateways failed');
}

async function checkAsset(asset) {
  const start = Date.now();
  const result = {
    assetId: asset.assetId,
    ipfsCid: asset.ipfsCid,
    expectedHash: asset.expectedHash,
    actualHash: null,
    status: 'unknown',
    gateway: null,
    bytes: 0,
    error: null,
    durationMs: 0,
    checkedAt: new Date().toISOString(),
  };
  try {
    const gateways = asset.gateways && asset.gateways.length ? asset.gateways : DEFAULT_GATEWAYS;
    const { bytes, gateway } = await fetchFromGateways(asset.ipfsCid, gateways);
    result.actualHash = sha256(bytes);
    result.gateway = gateway;
    result.bytes = bytes.length;
    result.status = result.actualHash === asset.expectedHash ? 'fresh' : 'mismatch';
  } catch (err) {
    result.status = 'unreachable';
    result.error = err.message || String(err);
  } finally {
    result.durationMs = Date.now() - start;
  }
  return result;
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
    },
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

async function runOnce() {
  const assets = loadAssets();
  console.log(`[fetcher] checking ${assets.length} asset(s)`);
  const results = [];
  for (const asset of assets) {
    const r = await checkAsset(asset);
    results.push(r);
    console.log(
      `[fetcher] ${r.assetId}  status=${r.status}  ` +
        (r.actualHash ? `hash=${r.actualHash.slice(0, 14)}…  ` : '') +
        `(${r.durationMs}ms)`
    );
  }
  const payload = persistState(results);
  console.log(
    `[fetcher] summary  fresh=${payload.summary.fresh}  ` +
      `mismatch=${payload.summary.mismatch}  unreachable=${payload.summary.unreachable}`
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

module.exports = { runOnce, checkAsset, sha256, loadAssets };
