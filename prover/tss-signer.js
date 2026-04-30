// prover/tss-signer.js
// Collects partial signatures from 5 signer nodes,
// aggregates them into the format expected by CircuitBreakerV2.
const axios = require('axios');
const { ethers } = require('ethers');

const SIGNER_NODES = [
  'http://localhost:7001',
  'http://localhost:7002',
  'http://localhost:7003',
  'http://localhost:7004',
  'http://localhost:7005',
];

async function collectSigs(digest) {
  const sigs = [];
  for (const node of SIGNER_NODES) {
    try {
      const { data } = await axios.post(`${node}/sign`, { digest });
      sigs.push({ signature: data.sig, signer: data.signer });
    } catch (err) {
      console.warn(`[tss-signer] Node ${node} failed: ${err.message}`);
    }
  }
  // Sort by signer address (ascending) — required by on-chain verification
  sigs.sort((a, b) => a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()));
  return sigs;
}

function aggregate(sigs) {
  const threshold = 3;
  if (sigs.length < threshold) {
    throw new Error(`Need at least ${threshold} signatures, got ${sigs.length}`);
  }
  // Concatenate the first `threshold` signatures (each 65 bytes: r,s,v)
  const selected = sigs.slice(0, threshold);
  const packed = ethers.concat(selected.map(s => s.signature));
  return ethers.hexlify(packed);
}

module.exports = { collectSigs, aggregate };
