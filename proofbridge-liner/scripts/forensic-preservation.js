const fs = require('fs');
const crypto = require('crypto');

function packageForensicEvidence(evaluation, rawPayload, pcr0) {
    const bundleId = `EVIDENCE-B-${evaluation.cid}-${Date.now()}`;
    const evidenceBundle = {
        meta: { bundleId, statute: 'Cybercrimes Act 19 of 2020', timestamp: new Date().toISOString(), collector: 'ProofBridge Liner v1.1 Enclave' },
        data: rawPayload,
        scoring: evaluation,
        hardwareAttestation: { pcr0 }
    };
    const checksum = crypto.createHash('sha512').update(JSON.stringify(evidenceBundle)).digest('hex');
    const sealed = { payload: evidenceBundle, checksum, sealedBy: 'TEE-PRIVATE-KEY-001' };
    const dir = 'docs/audit/forensics';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${bundleId}.json`, JSON.stringify(sealed, null, 2));
    return `${dir}/${bundleId}.json`;
}
module.exports = { packageForensicEvidence };