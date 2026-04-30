const crypto = require("crypto");

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/"
];

const FETCH_TIMEOUT_MS = 5000;
const BACKOFF_MS = [500, 1000, 2000]; // 0.5s → 1s → 2s

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/octet-stream" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } finally {
    clearTimeout(t);
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function resolveCID(cid) {
  const results = [];

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const data = await fetchWithTimeout(`${gateway}${cid}`, FETCH_TIMEOUT_MS);
      results.push({
        gateway,
        ok: true,
        hash: sha256(data),
      });
    } catch (err) {
      results.push({
        gateway,
        ok: false,
        error: err.message,
      });
    }
  }

  return results;
}

function evaluateResolution(results, expectedHash) {
  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);

  if (successes.length === 0) {
    return { status: "NETWORK_UNAVAILABLE" };
  }

  const mismatches = successes.filter(r => r.hash !== expectedHash);

  if (mismatches.length >= 2) {
    return {
      status: "HASH_MISMATCH",
      evidence: mismatches
    };
  }

  return {
    status: "CONSISTENT",
    observedHash: successes[0].hash,
    failures
  };
}

module.exports = {
  IPFS_GATEWAYS,
  FETCH_TIMEOUT_MS,
  BACKOFF_MS,
  resolveCID,
  evaluateResolution,
  sha256
};