/**
 * prover/ipfs-config.js
 * ----------------------------------------------------------
 * Drop-in IPFS gateway configuration module for ProofBridge Liner.
 *
 * Provides canonical gateway set, fetch logic, and resolution patterns
 * aligned with production-oriented IPFS usage for hash verification.
 */

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/"
];

const BACKOFF_MS = [500, 1000, 2000]; // 0.5s → 1s → 2s

async function fetchFromGateway(gateway, cid, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${gateway}${cid}`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/pdf,application/octet-stream"
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveDocument(cid, gateways = IPFS_GATEWAYS) {
  const results = [];

  for (const gateway of gateways) {
    try {
      const data = await fetchFromGateway(gateway, cid);
      results.push({ gateway, data, success: true });
    } catch (err) {
      results.push({ gateway, error: err.message, success: false });
    }
  }

  return results;
}

module.exports = {
  IPFS_GATEWAYS,
  BACKOFF_MS,
  fetchFromGateway,
  resolveDocument
};