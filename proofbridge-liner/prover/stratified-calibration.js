const { computePosteriorMean } = require('./scorer');

class StratifiedProver {
    constructor(config = { gamma: 20 }) {
        this.gamma = config.gamma || 20;
        this.thresholds = new Map();
    }

    recalibrate(cid, alpha, beta) {
        const tau_A = (alpha / (alpha + beta)) * 0.85;
        const tau_B = (alpha / (alpha + beta)) * (1 + 1 / this.gamma);
        this.thresholds.set(cid, {
            tau_A: Math.min(tau_A, 0.95),
            tau_B: Math.min(tau_B, 0.99)
        });
        return this.thresholds.get(cid);
    }

    evaluate(evidence) {
        const { cid, alpha, beta, mismatchCount, teeValidated, isEDRS } = evidence;
        const effectiveBeta = isEDRS ? beta * 1.5 : beta;
        const limits = this.thresholds.get(cid) || this.recalibrate(cid, alpha, effectiveBeta);
        const score = computePosteriorMean(alpha, effectiveBeta);
        const isClassB = !teeValidated || (isEDRS && mismatchCount > 0) || mismatchCount > 1;
        const targetThreshold = isClassB ? limits.tau_B : limits.tau_A;

        return {
            cid,
            score: score.toFixed(4),
            riskClass: isClassB ? 'B (Structural/Fraud)' : 'A (Administrative/Noise)',
            isActionable: score >= targetThreshold,
            thresholdUsed: targetThreshold.toFixed(4),
            action: score >= targetThreshold ? 'PROCEED' : 'ESCALATE_TO_RISK_DESK'
        };
    }
}
module.exports = StratifiedProver;