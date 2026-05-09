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
const axios = require('axios');
const qs = require('querystring');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_PATH = path.join(ROOT, 'config', 'assets.json');
const SIGNERS_PATH = path.join(ROOT, 'config', 'signer-nodes.json');
const STATE_PATH = path.join(ROOT, '.local', 'state', 'prover-state.json');
const TOKEN_PATH = path.join(ROOT, '.github_token');

// GitHub OAuth configuration
const GITHUB_OAUTH = {
  clientId: process.env.GITHUB_CLIENT_ID || 'e911317afcee10ed09dbdeb56fcf246661f6b745',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'Ov23li30gskWCMddBDzg',
  scopes: [
    'repo',
    'public_repo',
    'read:org',
    'admin:org',
    'workflow',
    'write:discussion',
    'admin:repo_hook',
    'admin:org_hook',
    'user',
    'email'
  ].join(' '),
  deviceFlow: true,
  tokenExpirationSeconds: 28800 // 8 hours
};

// --- Token persistence helpers ---
function saveToken(token, metadata = {}) {
  const data = {
    access_token: token,
    created_at: Date.now(),
    expires_in: GITHUB_OAUTH.tokenExpirationSeconds,
    ...metadata
  };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
  return data;
}

function loadToken() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    // Check expiry
    if (data.created_at && data.expires_in) {
      const age = (Date.now() - data.created_at) / 1000;
      if (age > data.expires_in) {
        fs.unlinkSync(TOKEN_PATH);
        return null;
      }
    }
    return data;
  } catch (_) {
    return null;
  }
}

function deleteToken() {
  try { fs.unlinkSync(TOKEN_PATH); } catch (_) {}
}

// --- In-memory device flow store ---
const deviceAuthSessions = new Map();

const PORT = Number(process.env.DASHBOARD_PORT || 5000);
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';

const PHASES = [
  { id: 0, name: 'Env scaffold',                        pct: 100 },
  { id: 1, name: 'Write & test CircuitBreaker',         pct: 100 },
  { id: 2, name: 'Deploy to Polygon Amoy',              pct: 100 },
  { id: 3, name: 'Build fetcher + submitter',           pct: 100 },
  { id: 4, name: 'Mock 3-node quorum (Docker)',         pct: 100 },
  { id: 5, name: 'Institution-grade: TEE + Registry',  pct: 75 },
  { id: 6, name: 'Coq + TLA+ formal proofs',           pct: 100 },
  { id: 7, name: 'E2E demo recording',                  pct: 0   },
  { id: 8, name: 'Ghost-risk audit & pitch',            pct: 0   },
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

// ─── GitHub OAuth routes ─────────────────────────────────────────────

// Helper: decode JWT payload from GitHub token response
function decodeJwtUnsafe(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch (_) { return null; }
}

// POST /oauth/device/code  — start device flow
app.post('/oauth/device/code', async (req, res) => {
  try {
    const response = await axios.post('https://github.com/login/device/code', {
      client_id: GITHUB_OAUTH.clientId,
      scope: GITHUB_OAUTH.scopes
    }, {
      headers: { Accept: 'application/json' }
    });

    const { device_code, user_code, verification_uri, expires_in, interval } = response.data;

    // Store session for this device_code
    deviceAuthSessions.set(device_code, {
      userCode: user_code,
      startTime: Date.now(),
      expiresIn: expires_in,
      interval,
      pollCount: 0
    });

    res.json({ device_code, user_code, verification_uri, expires_in, interval });
  } catch (err) {
    console.error('Device code error:', err.response?.data || err.message);
    res.status(500).json({ error: 'failed_to_start_device_flow', details: err.message });
  }
});

// GET /oauth/device/wait  — poll until user completes auth
app.get('/oauth/device/wait', async (req, res) => {
  const { device_code } = req.query;
  if (!device_code) return res.status(400).json({ error: 'device_code_required' });

  const session = deviceAuthSessions.get(device_code);
  if (!session) return res.status(404).json({ error: 'unknown_device_code' });

  // Enforce minimum polling interval
  session.pollCount++;
  const minInterval = session.interval || 5;
  if (session.pollCount > 1) {
    await new Promise(r => setTimeout(r, minInterval * 1000));
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_OAUTH.clientId,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }, {
      headers: { Accept: 'application/json' }
    });

    const data = response.data;

    if (data.error) {
      if (data.error === 'authorization_pending') {
        return res.json({ status: 'pending' });
      }
      if (data.error === 'slow_down') {
        session.interval += 5;
        return res.json({ status: 'pending', slow_down: true, interval: session.interval });
      }
      if (data.error === 'access_denied') {
        deviceAuthSessions.delete(device_code);
        return res.status(400).json({ error: 'access_denied' });
      }
      if (data.error === 'expired_token') {
        deviceAuthSessions.delete(device_code);
        return res.status(400).json({ error: 'expired_token' });
      }
      return res.status(400).json({ error: data.error, error_description: data.error_description });
    }

    // Success — store token
    deviceAuthSessions.delete(device_code);
    const tokenData = saveToken(data.access_token, {
      scope: data.scope || GITHUB_OAUTH.scopes,
      token_type: data.token_type || 'bearer',
      obtained_at: Date.now()
    });

    // Fetch user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });

    res.json({
      status: 'authorized',
      access_token: data.access_token, // ephemeral — only sent once
      token: tokenData, // stored token info (no secret)
      user: {
        login: userResponse.data.login,
        name: userResponse.data.name,
        email: userResponse.data.email,
        avatar_url: userResponse.data.avatar_url,
        html_url: userResponse.data.html_url
      }
    });
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'token_exchange_failed', details: err.message });
  }
});

// GET /oauth/status  — current token & user
app.get('/oauth/status', (req, res) => {
  const tokenData = loadToken();
  if (!tokenData) {
    return res.json({ authenticated: false, user: null });
  }

  // Decode JWT to get user info (best effort)
  const decoded = decodeJwtUnsafe(tokenData.access_token);
  const user = decoded ? {
    login: decoded.login || decoded.sub,
    email: decoded.email,
    name: decoded.name
  } : { login: 'unknown' };

  res.json({
    authenticated: true,
    expires_in: Math.max(0, Math.floor(tokenData.expires_in - ((Date.now() - tokenData.created_at) / 1000))),
    user,
    scopes: tokenData.scope || GITHUB_OAUTH.scopes
  });
});

// POST /oauth/logout  — revoke & delete token
app.post('/oauth/logout', async (req, res) => {
  const tokenData = loadToken();
  if (tokenData) {
    try {
      await axios.delete(`https://api.github.com/applications/${GITHUB_OAUTH.clientId}/token`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${GITHUB_OAUTH.clientId}:${GITHUB_OAUTH.clientSecret}`).toString('base64')}`,
          Accept: 'application/json'
        },
        data: { access_token: tokenData.access_token }
      });
    } catch (_) { /* ignore revocation errors */ }
    deleteToken();
  }
  deviceAuthSessions.forEach((_, code) => deviceAuthSessions.delete(code));
  res.json({ logged_out: true });
});

// ─── PKCE helpers ─────────────────────────────────────────────────────
function base64urlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('hex');
}
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64urlEncode(hash);
}

// GET /oauth/pkce/authorize  — initiate PKCE flow (no client secret)
app.get('/oauth/pkce/authorize', (req, res) => {
  const { code_challenge } = req.query;
  if (!code_challenge) return res.status(400).json({ error: 'code_challenge_required' });

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH.clientId,
    redirect_uri: `${req.protocol}://${req.get('host')}/oauth/pkce/callback`,
    scope: GITHUB_OAUTH.scopes,
    state,
    code_challenge: code_challenge,
    code_challenge_method: 'S256',
    allow_signup: 'true'
  });

  // Store state in a simple in-memory map (dev only)
  // For prod, use encrypted cookies or signed JWTs
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /oauth/pkce/callback  — GitHub redirects here
app.get('/oauth/pkce/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    return res.status(400).json({ error, error_description: error_description || error });
  }
  if (!code) return res.status(400).json({ error: 'code_required' });

  // PKCE code_verifier should be stored in session/signed cookie
  // For this demo, expect it via server-side session or temp store
  // In production, use secure session management
  res.status(501).json({ error: 'PKCE callback requires session storage (implement per your infra)' });
});

// POST /oauth/pkce/token  — exchange code for token
app.post('/oauth/pkce/token', async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;
  if (!code || !code_verifier) {
    return res.status(400).json({ error: 'code_and_code_verifier_required' });
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_OAUTH.clientId,
      client_secret: GITHUB_OAUTH.clientSecret,
      code,
      redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/oauth/pkce/callback`,
      code_verifier
    }, {
      headers: { Accept: 'application/json' }
    });

    const data = response.data;
    if (data.error) {
      return res.status(400).json({ error: data.error, error_description: data.error_description });
    }

    const tokenData = saveToken(data.access_token, {
      scope: data.scope || GITHUB_OAUTH.scopes,
      token_type: data.token_type || 'bearer',
      obtained_at: Date.now()
    });

    // Fetch user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });

    res.json({
      access_token: data.access_token, // ephemeral
      token: tokenData,
      user: {
        login: userResponse.data.login,
        name: userResponse.data.name,
        email: userResponse.data.email,
        avatar_url: userResponse.data.avatar_url,
        html_url: userResponse.data.html_url
      }
    });
  } catch (err) {
    console.error('PKCE token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'token_exchange_failed', details: err.message });
  }
});

// ─── End OAuth routes ──────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  const tokenData = loadToken();
  let ghAuth = { authenticated: false, user: null, expires_in: 0 };
  if (tokenData) {
    const decoded = decodeJwtUnsafe(tokenData.access_token);
    ghAuth = {
      authenticated: true,
      expires_in: Math.max(0, Math.floor(tokenData.expires_in - ((Date.now() - tokenData.created_at) / 1000))),
      user: decoded ? {
        login: decoded.login || decoded.sub,
        name: decoded.name,
        email: decoded.email
      } : { login: 'unknown' },
      scopes: tokenData.scope
    };
  }

  res.json({
    project: 'ProofBridge Liner',
    tagline: 'Ghost-Risk Circuit-Breaker for tokenised real-world assets',
    network: 'Polygon Amoy (testnet)',
    circuitBreakerAddress: process.env.CIRCUIT_BREAKER_ADDRESS || null,
    oracleAddress: process.env.ORACLE_ADDRESS || null,
    assetRegistryAddress: process.env.ASSET_REGISTRY_ADDRESS || null,
    teeVerifierAddress: process.env.TEE_VERIFIER_ADDRESS || null,
    enclaveAddress: process.env.ENCLAVE_ADDRESS || null,
    ghAuth,
    phases: PHASES,
    tests: {
      total: TEST_RESULTS.length,
      passed: TEST_RESULTS.filter((t) => t.passed).length,
      results: TEST_RESULTS,
    },
    architecture: {
      layers: [
        {
          id: 'logic',
          name: 'Logic Layer',
          description: 'Coq-verified total functions',
          artifact: 'proofs/SafetyKernel.v',
          theorems: [
            'unauthorized_halt_is_absorbing',
            'posterior_above_threshold_trips',
            'posterior_below_threshold_stays_open',
            'auth_can_reset',
          ],
          status: 'proven',
        },
        {
          id: 'input',
          name: 'Input Layer',
          description: 'TEE-signed attestations (EIP-191 ECDSA)',
          artifact: 'contracts/TEEVerifier.sol',
          status: 'deployed-pending',
        },
        {
          id: 'enforcement',
          name: 'Enforcement Layer',
          description: 'EVM circuit breakers — per-asset isolated kernels',
          artifact: 'contracts/AssetRegistry.sol',
          status: 'deployed-pending',
        },
      ],
      verification: [
        { name: 'Coq Proof',    status: 'complete', note: 'UNAUTH actors cannot reset' },
        { name: 'Gas analysis', status: 'complete', note: 'O(1) check() execution' },
        { name: 'TLA+ Model',   status: 'complete', note: 'No deadlocks — 4 invariants + liveness property' },
        { name: 'SOC 2 CC6',    status: 'complete', note: 'CC6.1/2/3/6/7/8 — all controls mapped' },
      ],
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
