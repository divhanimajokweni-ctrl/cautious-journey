/**
 * prover/submitter.js
 * ----------------------------------------------------------
 * Relays fetcher results into ProofBridge Liner actions.
 *
 * Reads .local/state/prover-state.json (produced by fetcher.js)
 * and, for every asset with status "fresh", plans
 * CircuitBreaker.updateProof(assetId, deedHash). For any asset
 * with status "mismatch" or "unreachable", plans tripCircuit(reason).
 *
 * The submitter now produces SafeKrypte-backed action attestations
 * before broadcast. This replaces unsafe local hot-wallet signing in
 * the MVP path while keeping contract broadcasting isolated until the
 * CircuitBreaker address and ABI are wired.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STATE_PATH = path.resolve(__dirname, '..', '.local', 'state', 'prover-state.json');
const ATTESTATION_PATH = path.resolve(__dirname, '..', '.local', 'state', 'submitter-attestations.json');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digestPayload(payload) {
  return `0x${crypto.createHash('sha256').update(stableJson(payload)).digest('hex')}`;
}

function planActions(state) {
  const actions = [];
  for (const r of state.results) {
    if (r.status === 'fresh') {
      actions.push({
        kind: 'updateProof',
        assetId: r.assetId,
        deedHash: r.actualHash,
      });
    } else if (r.status === 'mismatch') {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `mismatch: expected ${r.expectedHash}, got ${r.actualHash}`,
      });
    } else if (r.status === 'unreachable') {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `unreachable: ${r.error || 'unknown'}`,
      });
    }
  }
  return actions;
}

async function requestSafeKrypteSignature({ payload, digest }) {
  const baseUrl = process.env.SAFEKRYPTE_SIMULATOR_URL || 'http://localhost:3001';
  const keyId = process.env.SAFEKRYPTE_SIGNING_KEY_ID || 'proofbridge-oracle-dev';
  const timeoutMs = Number(process.env.SAFEKRYPTE_TIMEOUT_MS || 10000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/sign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.SAFEKRYPTE_API_KEY
          ? { authorization: `Bearer ${process.env.SAFEKRYPTE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        keyId,
        payload,
        digest,
        algorithm: process.env.SAFEKRYPTE_ALGORITHM || 'ECDSA_SECP256K1',
        encoding: 'hex',
      }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const body = bodyText ? JSON.parse(bodyText) : {};

    if (!response.ok) {
      throw new Error(`SafeKrypte signing failed: ${response.status} ${bodyText}`);
    }

    if (!body.signature) {
      throw new Error('SafeKrypte response missing signature');
    }

    return {
      signature: body.signature,
      signerAddress: body.signerAddress || null,
      keyId: body.keyId || keyId,
      auditId: body.auditId || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function attestActions(actions, state) {
  const attestations = [];

  for (const action of actions) {
    const payload = {
      type: 'ProofBridgeLinerAction',
      action,
      stateRunId: state.runId || null,
      stateGeneratedAt: state.generatedAt || null,
      issuedAt: new Date().toISOString(),
    };
    const digest = digestPayload(payload);
    const signed = await requestSafeKrypteSignature({ payload, digest });

    attestations.push({
      ...payload,
      digest,
      ...signed,
      backend: 'safekrypte-simulator',
    });
  }

  return attestations;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');

  if (!fs.existsSync(STATE_PATH)) {
    console.error('[submitter] no prover state found; run fetcher.js first.');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const actions = planActions(state);
  console.log(`[submitter] planning ${actions.length} on-chain action(s)`);

  for (const a of actions) {
    if (a.kind === 'updateProof') {
      console.log(`  -> updateProof(${a.assetId}, ${a.deedHash})`);
    } else {
      console.log(`  -> tripCircuit(${a.assetId}, "${a.reason}")`);
    }
  }

  const attestations = await attestActions(actions, state);
  fs.mkdirSync(path.dirname(ATTESTATION_PATH), { recursive: true });
  fs.writeFileSync(ATTESTATION_PATH, `${JSON.stringify({ attestations }, null, 2)}\n`);
  console.log(`[submitter] wrote ${attestations.length} SafeKrypte attestation(s) to ${ATTESTATION_PATH}`);

  if (dryRun || !process.env.CIRCUIT_BREAKER_ADDRESS) {
    console.log('[submitter] dry-run complete. Set CIRCUIT_BREAKER_ADDRESS to enable broadcast wiring.');
    return;
  }

  console.log('[submitter] broadcast not yet enabled; SafeKrypte attestations generated successfully.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[submitter] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  attestActions,
  digestPayload,
  planActions,
  requestSafeKrypteSignature,
  stableJson,
};
