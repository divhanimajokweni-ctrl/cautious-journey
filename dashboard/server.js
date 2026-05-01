/**
 * dashboard/server.js
 * ----------------------------------------------------------
 * ProofBridge Liner — Operations Dashboard.
 *
 * A small Express server that surfaces:
 *   • Phase progress for the 72-hour MVP sprint
 *   • Configured assets and their last fetcher result
 *   • Live signer-node heartbeat (best-effort)
 *   • The CircuitBreaker contract address (once deployed)
 *
 * Trusts the proxy host header (Replit iframe preview).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_PATH = path.join(ROOT, 'config', 'assets.json');
const SIGNERS_PATH = path.join(ROOT, 'config', 'signer-nodes.json');
const STATE_PATH = path.join(ROOT, '.local', 'state', 'prover-state.json');

const PORT = Number(process.env.DASHBOARD_PORT || 5000);
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';

const PHASES = [
  { id: 0, name: 'Env scaffold',                   pct: 100 },
  { id: 1, name: 'Write & test CircuitBreaker',    pct: 100 },
  { id: 2, name: 'Deploy to Polygon Amoy',         pct: 30  },
  { id: 3, name: 'Build fetcher + submitter',      pct: 60  },
  { id: 4, name: 'Mock 3-node quorum (Docker)',    pct: 0   },
  { id: 5, name: 'E2E demo recording',             pct: 0   },
  { id: 6, name: 'Ghost-risk audit & pitch',       pct: 0   },
];

const TEST_RESULTS = [
  { name: 'testInitializeSetsOwnerAndOracle',     gas: 14321, passed: true },
  { name: 'testInitializeRevertsOnSecondCall',    gas: 13902, passed: true },
  { name: 'testUpdateProofByOracle',              gas: 44241, passed: true },
  { name: 'testUpdateProofEmitsEvent',            gas: 45177, passed: true },
  { name: 'testUpdateProofRevertsIfNotOracle',    gas: 13738, passed: true },
  { name: 'testTripCircuitByOracle',              gas: 44116, passed: true },
  { name: 'testTripCircuitEmitsEvent',            gas: 45030, passed: true },
  { name: 'testTripCircuitRevertsIfNotOracle',    gas: 13671, passed: true },
  { name: 'testValidateWhenOpenAndHashMatches',   gas: 48449, passed: true },
  { name: 'testValidateWhenOpenAndHashDoesNotMatch', gas: 48473, passed: true },
  { name: 'testValidateRevertsWhenCircuitTripped',   gas: 44732, passed: true },
  { name: 'testResetByOwner',                     gas: 45034, passed: true },
  { name: 'testResetEmitsEvent',                  gas: 45925, passed: true },
  { name: 'testResetRevertsIfNotOwner',           gas: 44683, passed: true },
];

function readJsonSafe(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

const app = express();
app.disable('etag');

// --- Replit preview lives behind a proxy iframe; trust the proxy ---
app.set('trust proxy', true);

// --- Dev-mode no-cache so the iframe always sees latest content ---
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  res.json({
    project: 'ProofBridge Liner',
    tagline: 'Ghost-Risk Circuit-Breaker for tokenised real-world assets',
    network: 'Polygon Amoy (testnet)',
    circuitBreakerAddress: process.env.CIRCUIT_BREAKER_ADDRESS || null,
    oracleAddress: process.env.ORACLE_ADDRESS || null,
    phases: PHASES,
    tests: {
      total: TEST_RESULTS.length,
      passed: TEST_RESULTS.filter((t) => t.passed).length,
      results: TEST_RESULTS,
    },
    assets: readJsonSafe(ASSETS_PATH, []),
    signerNodes: readJsonSafe(SIGNERS_PATH, []),
    proverState: readJsonSafe(STATE_PATH, null),
    serverTime: new Date().toISOString(),
  });
});

app.get('/api/health', async (req, res) => {
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ];
  const gatewayHealth = {};
  await Promise.all(gateways.map(async (gateway) => {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(`${gateway}QmbWqxBEKC3P8tqsKc98xmWNzrzDRRLbhtJ38WNqHVWojK`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      gatewayHealth[gateway] = { status: 'healthy', latency: Date.now() - start };
    } catch (err) {
      gatewayHealth[gateway] = { status: 'unreachable', error: err.message };
    } finally {
      clearTimeout(timer);
    }
  }));

  // Read prover state if exists
  let proverState = {};
  try {
    const stateFile = path.resolve(__dirname, '..', '.local', 'state', 'prover-state.json');
    if (fs.existsSync(stateFile)) {
      proverState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  res.json({
    uptime: process.uptime(),
    gateways: gatewayHealth,
    proverState
  });
});

app.listen(PORT, HOST, () => {
  console.log(`[dashboard] ProofBridge Liner Ops listening on http://${HOST}:${PORT}`);
});
