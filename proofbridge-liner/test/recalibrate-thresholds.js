const StratifiedProver = require('../prover/stratified-calibration');

console.log('Testing threshold recalibration...');

const kernel = new StratifiedProver({ gamma: 20 });

// Test recalibration
const thresholds = kernel.recalibrate('TEST_CID', 10, 2);
console.log('Recalibrated Thresholds:', thresholds);

// Verify calculations
const expectedTauA = (10 / 12) * 0.85; // approx 0.7083
const expectedTauB = (10 / 12) * (1 + 1/20); // approx 0.8917

if (Math.abs(thresholds.tau_A - expectedTauA) > 0.01 || Math.abs(thresholds.tau_B - expectedTauB) > 0.01) {
    throw new Error('Recalibration test failed');
}

console.log('Recalibration test passed!');