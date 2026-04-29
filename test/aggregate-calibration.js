// test/aggregate-calibration.js
// Aggregate empirical priors from multiple calibration runs.
// ProofBridge Liner probabilistic evidentiary layer

const fs = require("fs");
const path = require("path");

const calibrationDir = process.env.CALIBRATION_DIR || "test/calibration-runs/latest";
const strength = Number(process.env.STRENGTH || 10);

const files = fs
  .readdirSync(calibrationDir)
  .filter((f) => /^calibration-data-\d+\.json$/.test(f))
  .map((f) => path.join(calibrationDir, f));

if (files.length < 1) {
  throw new Error(`Expected at least 1 calibration file, found ${files.length}`);
}

let totalMatches = 0;
let totalMismatches = 0;
let totalUnreachable = 0;

console.log("Aggregating calibration data...");
console.log(`Directory: ${calibrationDir}`);

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  totalMatches += Number(data.totalMatches || 0);
  totalMismatches += Number(data.totalMismatches || 0);
  totalUnreachable += Number(data.totalUnreachable || 0);

  console.log(`- Included ${path.basename(file)}`);
}

const totalObservations = totalMatches + totalMismatches;

if (totalObservations === 0) {
  throw new Error("No calibration observations found.");
}

// Smoothed empirical mismatch rate.
// Prevents zero-alpha collapse when no mismatches are observed.
const mismatchRate = (1 + totalMismatches) / (2 + totalObservations);

const finalAlpha = mismatchRate * strength;
const finalBeta = (1 - mismatchRate) * strength;

console.log("\nFinal Aggregated Prior:");
console.log(`Total matches: ${totalMatches}`);
console.log(`Total mismatches: ${totalMismatches}`);
console.log(`Total unreachable: ${totalUnreachable}`);
console.log(`Total observations: ${totalObservations}`);
console.log(`Empirical mismatch rate: ${mismatchRate.toFixed(6)}`);
console.log(`Suggested alpha: ${finalAlpha.toFixed(6)}`);
console.log(`Suggested beta: ${finalBeta.toFixed(6)}`);

console.log(
  `\nNext step: node test/recalibrate-thresholds.js --alpha ${finalAlpha.toFixed(
    6
  )} --beta ${finalBeta.toFixed(6)} --gamma 10`
);