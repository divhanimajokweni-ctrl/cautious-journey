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
const { ethers } = require('ethers');

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
  const { scoreAsset } = require('./scorer');
  const actions = [];
  for (const r of state.results) {
    const score = scoreAsset(r.gatewayResults);

    if (score.trip) {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `Stratified trigger: scenario ${score.scenario}, score ${score.triggerScore.toFixed(3)} ≥ ${score.thresholdUsed}`,
      });
    } else if (r.status === 'fresh') {
      actions.push({
        kind: 'updateProof',
        assetId: r.assetId,
        deedHash: r.actualHash,
      });
    } else if (r.status === 'unreachable_threshold') {
      actions.push({
        kind: 'tripCircuit',
        assetId: r.assetId,
        reason: `Document unreachable after ${r.consecutiveUnreachable} consecutive polls`,
      });
    }
  }
  return actions;
}

async function requestThresholdSignature(digest) {
  const { collectSigs, aggregate } = require('./tss-signer');
  const sigs = await collectSigs(digest);
  const aggregated = aggregate(sigs);
  return {
    signature: aggregated,
    signerAddresses: sigs.map(s => s.signer),
    keyId: 'threshold-quorum',
    auditId: null,
  };
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
    // For V2, use threshold digest
    let digest;
    if (action.kind === 'updateProof') {
      // actionDigest(assetId, deedHash) = keccak256(abi.encodePacked(assetId, deedHash, block.chainid, address(this)))
      const contractAddress = process.env.CIRCUIT_BREAKER_ADDRESS || '0x1234567890123456789012345678901234567890';
      const chainId = 80002; // Polygon Amoy
      digest = ethers.keccak256(ethers.concat([action.assetId, action.deedHash, ethers.toBeHex(chainId, 32), contractAddress]));
    } else if (action.kind === 'tripCircuit') {
      const contractAddress = process.env.CIRCUIT_BREAKER_ADDRESS || '0x1234567890123456789012345678901234567890';
      const chainId = 80002;
      digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes(action.reason), ethers.toBeHex(chainId, 32), contractAddress]));
    }
    const signed = await requestThresholdSignature(digest);

    attestations.push({
      ...payload,
      digest,
      ...signed,
      backend: 'threshold-quorum',
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
  requestThresholdSignature,
  stableJson,
};
