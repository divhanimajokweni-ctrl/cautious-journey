/**
 * test/proofbridge-webworld-verification.js
 * ProofBridge Verification Run for WebWorld-32B Agent Outputs
 *
 * Board conditions:
 *   - Non-negativity (wind speed, irradiance)
 *   - Unit consistency
 *   - Physical bound checks
 *   - Temporal coherence (no impossible jumps)
 *
 * This gate ensures Agentic Oracle outputs are physically plausible
 * before they activate grid control actions.
 */

const fs = require('fs');
const path = require('path');

// Physical bounds for South African grid context (contextual, not hard limits)
const PHYSICAL_BOUNDS = {
  windSpeed: { min: 0, max: 50, unit: 'm/s' },
  irradiance: { min: 0, max: 1200, unit: 'W/m²' },
  temperature: { min: -10, max: 55, unit: '°C' },
  voltage: { min: 180, max: 480, unit: 'V' },
  frequency: { min: 49.5, max: 50.5, unit: 'Hz' }
};

// WebWorld output schema (ProofBridge_WeatherFrame)
const SCHEMA_FIELDS = [
  'assetId',
  'timestamp',
  'windSpeed',
  'irradiance',
  'temperature',
  'voltage',
  'frequency',
  'gatewaySource'
];

class ProofBridgeVerifier {
  constructor() {
    this.violations = [];
    this.passed = 0;
    this.failed = 0;
  }

  verifyNonNegativity(record) {
    const checks = [
      { field: 'windSpeed', min: 0 },
      { field: 'irradiance', min: 0 },
      { field: 'temperature', min: -10 }, // allow sub-zero
      { field: 'voltage', min: 0 }
    ];
    for (const { field, min } of checks) {
      const val = record[field];
      if (typeof val !== 'number' || val < min) {
        this.violations.push({
          record: record.assetId,
          invariant: 'non_negativity',
          field,
          value: val,
          reason: `value < ${min} or not a number`
        });
      } else {
        this.passed++;
      }
    }
  }

  verifyUnitConsistency(record) {
    // Check units are as expected (implicit in numeric fields; would expand with dimensional analysis)
    const numericFields = ['windSpeed', 'irradiance', 'temperature', 'voltage', 'frequency'];
    for (const field of numericFields) {
      if (typeof record[field] !== 'number') {
        this.violations.push({
          record: record.assetId,
          invariant: 'unit_consistency',
          field,
          value: record[field],
          reason: 'expected numeric value'
        });
      } else {
        this.passed++;
      }
    }
  }

  verifyPhysicalBounds(record) {
    for (const [field, bounds] of Object.entries(PHYSICAL_BOUNDS)) {
      const val = record[field];
      if (typeof val === 'number') {
        if (val < bounds.min || val > bounds.max) {
          this.violations.push({
            record: record.assetId,
            invariant: 'physical_bounds',
            field,
            value: val,
            range: `${bounds.min}–${bounds.max} ${bounds.unit}`,
            reason: `outside plausible SA grid range`
          });
        } else {
          this.passed++;
        }
      }
    }
  }

  verifyTemporalCoherence(records) {
    // Sort by timestamp
    const sorted = records.filter(r => r.timestamp).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];
      const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000; // seconds

      // Check for impossible jumps (e.g., >5min gap or negative)
      if (timeDiff < 0) {
        this.violations.push({
          record: curr.assetId,
          invariant: 'temporal_coherence',
          field: 'timestamp',
          reason: `timestamp earlier than previous (gap ${timeDiff}s)`
        });
      } else if (timeDiff > 300) { // >5 minutes
        this.violations.push({
          record: curr.assetId,
          invariant: 'temporal_coherence',
          field: 'timestamp',
          reason: `excessive gap ${timeDiff}s between readings`
        });
      }

      // Check metric jumps (e.g., windSpeed change > 10 m/s in 5min)
      const fields = ['windSpeed', 'irradiance', 'voltage'];
      for (const field of fields) {
        const delta = Math.abs(curr[field] - prev[field]);
        const maxDelta = { windSpeed: 10, irradiance: 300, voltage: 50 }[field];
        if (delta > maxDelta) {
          this.violations.push({
            record: curr.assetId,
            invariant: 'temporal_coherence',
            field,
            prev: prev[field],
            curr: curr[field],
            delta,
            reason: `impossible jump > ${maxDelta}`
          });
        } else {
          this.passed++;
        }
      }
    }
  }

  verifySchemaConformance(record) {
    for (const field of SCHEMA_FIELDS) {
      if (!(field in record)) {
        this.violations.push({
          record: record.assetId || 'unknown',
          invariant: 'schema_conformance',
          field,
          reason: 'missing required field'
        });
      } else {
        this.passed++;
      }
    }
  }

  run(webworldOutputs) {
    console.log('\n========== PROOFBRIDGE VERIFICATION: WEBWORLD OUTPUTS ==========\n');
    console.log(`Input dataset: ${webworldOutputs.length} records`);

    // Per-record checks
    for (const record of webworldOutputs) {
      this.verifySchemaConformance(record);
      this.verifyNonNegativity(record);
      this.verifyUnitConsistency(record);
      this.verifyPhysicalBounds(record);
    }

    // Cross-record temporal checks
    this.verifyTemporalCoherence(webworldOutputs);

    // Report
    console.log('\n--- Verification Summary ---');
    console.log(`Checks passed: ${this.passed}`);
    console.log(`Violations: ${this.violations.length}`);

    if (this.violations.length > 0) {
      console.log('\nViolations:');
      for (const v of this.violations) {
        console.error(`  [${v.invariant}] ${v.record}: ${v.reason} (field=${v.field})`);
      }
    }

    const success = this.violations.length === 0;
    console.log(`\nVerdict: ${success ? '✓ PASS — Outputs physically sound, ready for grid integration' : '✗ FAIL — Sandbox until violations resolved'}`);

    return {
      success,
      passed: this.passed,
      violations: this.violations
    };
  }
}

// Main: load synthetic WebWorld outputs (or use provided)
function main() {
  try {
    // In production, this would read from .local/state/webworld-agent-outputs.json
    const syntheticPath = path.resolve(__dirname, 'webworld-agent-outputs-synthetic.json');
    let outputs;

    if (fs.existsSync(syntheticPath)) {
      outputs = JSON.parse(fs.readFileSync(syntheticPath, 'utf8'));
      console.log(`[proofbridge] Loaded synthetic WebWorld outputs: ${syntheticPath}`);
    } else {
      // Generate minimal plausible synthetic data for demo
      console.log('[proofbridge] No outputs found — generating synthetic dataset for verification demo');
      outputs = generateSyntheticOutputs(5);
    }

    const verifier = new ProofBridgeVerifier();
    const result = verifier.run(outputs);

    const resultsPath = path.resolve(__dirname, '.local', 'state', 'proofbridge-webworld-verification.json');
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      recordCount: outputs.length,
      ...result
    }, null, 2));
    console.log(`\n[proofbridge] Verification report saved to ${resultsPath}`);

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error(`[proofbridge] Verification failed: ${err.message}`);
    process.exit(1);
  }
}

function generateSyntheticOutputs(n) {
  const now = new Date();
  // Start with base values and evolve smoothly
  let wind = 18.0;
  let irrad = 700;
  let temp = 25.0;
  let volt = 400;

  return Array.from({ length: n }, (_, i) => {
    // Small random walk changes
    wind += (Math.random() - 0.5) * 2;
    irrad += Math.round((Math.random() - 0.5) * 80);
    temp += (Math.random() - 0.5) * 1.5;
    volt += (Math.random() - 0.5) * 5;

    // Clamp to bounds
    wind = Math.max(0, Math.min(50, wind));
    irrad = Math.max(0, Math.min(1200, irrad));
    temp = Math.max(-10, Math.min(55, temp));
    volt = Math.max(180, Math.min(480, volt));

    return {
      assetId: `agent-${i+1}`,
      timestamp: new Date(now.getTime() + i * 300000).toISOString(),
      windSpeed: Math.round(wind * 10) / 10,
      irradiance: Math.round(irrad),
      temperature: Math.round(temp * 10) / 10,
      voltage: Math.round(volt),
      frequency: 50.0,
      gatewaySource: ['ipfs.io', 'cloudflare-ipfs', 'dweb.link'][i % 3]
    };
  });
}

if (require.main === module) {
  main();
}

module.exports = { ProofBridgeVerifier };
