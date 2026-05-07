const StratifiedProver = require('./stratified-calibration');
const { fetchDeedData } = require('../adapters/deeds-registry');
const { generateAttestedLog, handleHighRiskEvent } = require('../scripts/generate-compliance-logs');

const safetyKernel = new StratifiedProver({ gamma: 20 });

async function processProofRequest(cid) {
    const deedEvidence = await fetchDeedData(cid);
    const evaluation = safetyKernel.evaluate(deedEvidence);
    const signedLog = generateAttestedLog(evaluation);

    if (!evaluation.isActionable && evaluation.riskClass.includes('B')) {
        handleHighRiskEvent(evaluation, deedEvidence, signedLog);
    }

    return {
        status: evaluation.isActionable ? 'SUCCESS' : 'REJECTED',
        data: evaluation,
        routing: evaluation.action
    };
}

module.exports = { processProofRequest, safetyKernel };