const StratifiedProver = require('../prover/stratified-calibration');

console.log('Running stratified simulation tests...');

const kernel = new StratifiedProver({ gamma: 20 });

// Test Class A scenario
const evidenceA = { cid: 'TEST_A', alpha: 15, beta: 1, mismatchCount: 0, teeValidated: true, isEDRS: false };
const resultA = kernel.evaluate(evidenceA);
console.log('Class A Test:', resultA);
if (!resultA.isActionable || resultA.riskClass !== 'A (Administrative/Noise)') {
    throw new Error('Class A test failed');
}

// Test Class B scenario
const evidenceB = { cid: 'TEST_B', alpha: 5, beta: 8, mismatchCount: 3, teeValidated: false, isEDRS: true };
const resultB = kernel.evaluate(evidenceB);
console.log('Class B Test:', resultB);
if (resultB.isActionable || resultB.riskClass !== 'B (Structural/Fraud)') {
    throw new Error('Class B test failed');
}

console.log('All tests passed!');