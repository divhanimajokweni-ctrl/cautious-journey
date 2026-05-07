const { safetyKernel } = require('../prover/main');
const { generateAttestedLog, handleHighRiskEvent } = require('./generate-compliance-logs');
const { notifyCISO } = require('./notifiers');

(async () => {
    const payload = { cid: 'SIM_FRAUD_001', alpha: 2, beta: 15, mismatchCount: 8, teeValidated: false };
    const evaluation = safetyKernel.evaluate(payload);
    const signedLog = generateAttestedLog(evaluation);
    const reportPath = `docs/audit/JS2_REPORT_SIM_FRAUD_001.txt`;
    if (!evaluation.isActionable && evaluation.riskClass.includes('B')) {
        handleHighRiskEvent(evaluation, payload, signedLog);
        await notifyCISO(reportPath, evaluation);
    }
    console.log('Red team simulation complete.');
})();