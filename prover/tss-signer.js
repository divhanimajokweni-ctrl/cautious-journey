/**
 * prover/tss-signer.js
 * ----------------------------------------------------------
 * Phase 4 stub: collects t-of-n signatures from the mock
 * quorum running under signer-nodes/docker-compose.yml.
 *
 * For the MVP this returns an empty bytes string; the
 * CircuitBreaker contract does not yet verify a quorum
 * signature on-chain (see ratified decision matrix).
 *
 * The interface is here so the submitter can be wired up
 * end-to-end and the upgrade to EIP-712 verification is
 * a one-file change.
 */

const fs = require('fs');
const path = require('path');

function loadSignerNodes() {
  const cfgPath = path.resolve(__dirname, '..', 'config', 'signer-nodes.json');
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

/**
 * Request signatures from the configured quorum.
 * @param {{ assetId: string, deedHash: string }} payload
 * @returns {Promise<{ signatures: string[], aggregated: string }>}
 */
async function collectSignatures(payload) {
  const nodes = loadSignerNodes();
  const signatures = [];
  for (const node of nodes) {
    try {
      const res = await fetch(`${node.endpoint}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body.signature) signatures.push(body.signature);
    } catch (_) {
      // node down -> skip; quorum logic handles t-of-n.
    }
  }
  return { signatures, aggregated: '0x' };
}

module.exports = { collectSignatures, loadSignerNodes };
