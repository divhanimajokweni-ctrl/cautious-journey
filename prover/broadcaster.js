// prover/broadcaster.js
// CommonJS — reads signed attestations, broadcasts to CircuitBreaker on Amoy
// SafeKrypte signs attestations; oracle private key signs transaction envelopes
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
const ATTESTATIONS_FILE = path.resolve(
  __dirname,
  "..",
  ".local",
  "state",
  "submitter-attestations.json"
);
const RECEIPTS_FILE = path.resolve(
  __dirname,
  "..",
  ".local",
  "state",
  "broadcast-receipts.json"
);

// ---------------------------------------------------------------------------
// ABI — exactly matching CircuitBreaker.sol
// ---------------------------------------------------------------------------
const CIRCUIT_BREAKER_ABI = [
  "function updateProof(bytes32 assetId, bytes32 deedHash) external",
  "function tripCircuit(string calldata reason) external",
  "function circuitOpen() external view returns (bool)",
  "function latestProof(bytes32 assetId) external view returns (bytes32)",
  "function oracle() external view returns (address)",
];

// ---------------------------------------------------------------------------
// Idempotency: receipt store
// ---------------------------------------------------------------------------
function loadReceipts() {
  if (!fs.existsSync(RECEIPTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(RECEIPTS_FILE, "utf-8"));
  } catch {
    console.warn("[broadcaster] Could not parse receipts — starting fresh.");
    return {};
  }
}

function saveReceipts(receipts) {
  const dir = path.dirname(RECEIPTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(receipts, null, 2));
}

// ---------------------------------------------------------------------------
// Attestation loader — handles { attestations: [...] } or raw array
// ---------------------------------------------------------------------------
function loadAttestations() {
  if (!fs.existsSync(ATTESTATIONS_FILE)) return [];

  const raw = JSON.parse(fs.readFileSync(ATTESTATIONS_FILE, "utf-8"));
  const attestations = Array.isArray(raw) ? raw : raw.attestations;

  if (!Array.isArray(attestations)) {
    throw new Error("Attestations file must be an array or { attestations: [...] }");
  }
  return attestations;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateAttestation(att) {
  const required = ["digest", "signature", "keyId", "action"];
  for (const f of required) {
    if (!att[f]) throw new Error(`Missing field: ${f}`);
  }

  const { kind, assetId, deedHash, reason } = att.action;
  if (!["updateProof", "tripCircuit"].includes(kind)) {
    throw new Error(`Unknown action kind: ${kind}`);
  }

  if (kind === "updateProof") {
    if (!ethers.isHexString(assetId, 32)) throw new Error("Invalid assetId");
    if (!ethers.isHexString(deedHash, 32)) throw new Error("Invalid deedHash");
  }

  if (kind === "tripCircuit") {
    if (!reason || typeof reason !== "string") throw new Error("tripCircuit requires reason");
  }
}

// ---------------------------------------------------------------------------
// Single attestation broadcast
// ---------------------------------------------------------------------------
async function broadcastOne(contract, att, receipts, options = {}) {
  const digest = att.digest;

  // 1. Receipt guard
  if (receipts[digest]) {
    console.log(`[broadcaster] SKIP ${digest.slice(0, 16)}... — already broadcast (tx: ${receipts[digest].txHash})`);
    return { skipped: true, digest, txHash: receipts[digest].txHash };
  }

  if (options.dryRun) {
    console.log(`[broadcaster] DRY-RUN ${digest.slice(0, 16)}... — would send ${att.action.kind}`);
    return { dryRun: true, digest };
  }

  const { kind, assetId, deedHash, reason } = att.action;
  let tx;

  if (kind === "updateProof") {
    // On-chain idempotency: skip if deedHash already set
    try {
      const onChain = await contract.latestProof(assetId);
      if (onChain.toLowerCase() === deedHash.toLowerCase()) {
        console.log("[broadcaster] SKIP updateProof — deedHash already on-chain");
        receipts[digest] = { txHash: "already-on-chain", timestamp: new Date().toISOString() };
        saveReceipts(receipts);
        return { skipped: true, digest, reason: "already-on-chain" };
      }
    } catch (err) {
      console.warn(`[broadcaster] Could not read latestProof (continuing): ${err.message}`);
    }

    console.log(`[broadcaster] SEND updateProof assetId=${assetId.slice(0, 16)}... digest=${digest.slice(0, 16)}...`);
    tx = await contract.updateProof(assetId, deedHash);
  }

  if (kind === "tripCircuit") {
    // Circuit state guard
    try {
      const open = await contract.circuitOpen();
      if (!open) {
        console.log("[broadcaster] SKIP tripCircuit — circuit already tripped");
        receipts[digest] = { txHash: "circuit-already-tripped", timestamp: new Date().toISOString() };
        saveReceipts(receipts);
        return { skipped: true, digest, reason: "circuit-already-tripped" };
      }
    } catch (err) {
      console.warn(`[broadcaster] Could not read circuitOpen (continuing): ${err.message}`);
    }

    console.log(`[broadcaster] SEND tripCircuit reason="${reason}" digest=${digest.slice(0, 16)}...`);
    tx = await contract.tripCircuit(reason);
  }

  console.log(`[broadcaster] WAIT ${tx.hash}...`);
  const receipt = await tx.wait();

  receipts[digest] = {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString(),
    attestationDigest: digest,
    action: att.action,
    keyId: att.keyId,
  };
  saveReceipts(receipts);

  console.log(`[broadcaster] CONFIRMED block ${receipt.blockNumber} gas ${receipt.gasUsed} tx ${receipt.hash}`);
  return { success: true, digest, txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function broadcast(options = {}) {
  const attestations = loadAttestations();
  if (!attestations.length) {
    console.log("[broadcaster] No attestations — nothing to broadcast.");
    return [];
  }

  console.log(`[broadcaster] Loaded ${attestations.length} attestation(s)`);

  // Env check
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL || process.env.RPC_URL;
  const oracleKey = process.env.ORACLE_PRIVATE_KEY;
  const contractAddr = process.env.CIRCUIT_BREAKER_ADDRESS;

  if (!rpcUrl) throw new Error("Missing RPC_URL / POLYGON_AMOY_RPC_URL");
  if (!oracleKey) throw new Error("Missing ORACLE_PRIVATE_KEY");
  if (!contractAddr) throw new Error("Missing CIRCUIT_BREAKER_ADDRESS");
  if (!ethers.isAddress(contractAddr)) throw new Error("Invalid CIRCUIT_BREAKER_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(oracleKey, provider);
  const contract = new ethers.Contract(contractAddr, CIRCUIT_BREAKER_ABI, signer);

  // Verify oracle identity
  const onChainOracle = await contract.oracle();
  if (signer.address.toLowerCase() !== onChainOracle.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} ≠ on-chain oracle ${onChainOracle}. ` +
      "onlyOracle will reject all transactions."
    );
  }
  console.log(`[broadcaster] Oracle identity confirmed: ${signer.address}`);

  const receipts = loadReceipts();
  const results = [];

  for (const att of attestations) {
    try {
      validateAttestation(att);
      const r = await broadcastOne(contract, att, receipts, options);
      results.push(r);
    } catch (err) {
      console.error(`[broadcaster] FAILED ${att.digest?.slice(0, 16) || "unknown"}: ${err.message}`);
      results.push({ error: true, digest: att.digest, message: err.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const skipped  = results.filter(r => r.skipped).length;
  const dryRuns  = results.filter(r => r.dryRun).length;
  const failed   = results.filter(r => r.error).length;

  console.log(`[broadcaster] Done — ${succeeded} sent, ${skipped} skipped, ${dryRuns} dry-run, ${failed} failed`);
  return results;
}

module.exports = {
  broadcast,
  broadcastOne,
  loadAttestations,
  loadReceipts,
  saveReceipts,
  validateAttestation,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--dry");
  broadcast({ dryRun })
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error(`[broadcaster] Fatal: ${err.message}`);
      process.exit(1);
    });
}
