const StratifiedProver = require('./prover/stratified-calibration');

const kernel = new StratifiedProver({ gamma: 20 });
const scenarios = [
    { name: "SCENARIO 1: Minor Typo (Class A)", evidence: { cid: "DEED_001_SMIT", alpha: 15, beta: 1, mismatchCount: 1, teeValidated: true } },
    { name: "SCENARIO 2: Identity Hijack (Class B)", evidence: { cid: "DEED_002_FRAUD", alpha: 5, beta: 8, mismatchCount: 3, teeValidated: false } }
];
scenarios.forEach(s => {
    const res = kernel.evaluate(s.evidence);
    console.log(`\n${s.name}\n  Decision: ${res.action}\n  Score: ${res.score} (Threshold: ${res.thresholdUsed})\n  Risk: ${res.riskClass}`);
});