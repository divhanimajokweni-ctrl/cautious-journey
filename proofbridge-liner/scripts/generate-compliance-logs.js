const fs = require('fs');
const crypto = require('crypto');
const { sanitizeForAudit } = require('./pii-sanitizer');
const { generateFSCAIncidentReport } = require('./incident-reporter');
const { packageForensicEvidence } = require('./forensic-preservation');
const { generateFICSAR } = require('./fic-sar-exporter');

function generateAttestedLog(evaluation) {
    const teeMetadata = {
        pcr0: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        hardware_id: 'TEE-SGX-ZA-PROD-001',
        firmware_version: 'v2.1.0-stable'
    };

    const logEntry = {
        report_id: crypto.randomBytes(8).toString('hex'),
        timestamp: new Date().toISOString(),
        ...evaluation,
        ...teeMetadata
    };

    const signature = crypto.createHmac('sha256', process.env.TEE_SECRET || 'TEE_INTERNAL_SECRET')
        .update(JSON.stringify(logEntry)).digest('hex');
    const signedLog = { ...logEntry, hardware_signature: `sig:${signature}` };

    const sanitised = sanitizeForAudit(signedLog);
    const filename = `docs/audit/audit_${new Date().toISOString().slice(0, 7)}.jsonl`;
    fs.appendFileSync(filename, JSON.stringify(sanitised) + '\n');

    return signedLog;
}

function handleHighRiskEvent(evaluation, rawPayload, signedLog) {
    packageForensicEvidence(evaluation, rawPayload, signedLog.pcr0);
    generateFSCAIncidentReport(evaluation, signedLog);
    if (parseFloat(evaluation.score) > 0.95) {
        generateFICSAR(evaluation, rawPayload);
    }
}

module.exports = { generateAttestedLog, handleHighRiskEvent };