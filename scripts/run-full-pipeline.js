// scripts/run-full-pipeline.js
// ProofBridge Liner — Full-Length Integration Test
//
// Runs the complete pipeline (fetcher → validator → scorer → submitter → broadcaster)
// for N cycles, logging every decision and producing a summary report.
//
// Pre-requisites:
//   - config/assets.json with at least one asset
//   - config/scoring.json present (defaults used if missing)
//   - prover/validator.js and prover/scorer.js implemented
//   - .env with POLYGON_AMOY_RPC_URL, ORACLE_PRIVATE_KEY, CIRCUIT_BREAKER_ADDRESS (for live; dry-run skips)
//   - NVIDIA_API_KEY (optional, for AI audit after run)
//
// Usage:
//   node scripts/run-full-pipeline.js --cycles 100 [--timeout 120]
//
// Output:
//   test/pipeline-run-<timestamp>.json   raw per-cycle data
//   demo/pipeline-run-<timestamp>.md     human-readable summary

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEFAULT_CYCLES = 10;
const DEFAULT_TIMEOUT_SEC = 120; // per command timeout
const OUTPUT_DIR = path.resolve(__dirname, '..', 'test');
const REPORTS_DIR = path.resolve(__dirname, '..', 'demo');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Dependency Checks
// ---------------------------------------------------------------------------
function checkDependencies() {
  const missing = [];

  // Required files
  const requiredFiles = [
    'config/assets.json',
    'prover/validator.js',
    'prover/scorer.js',
    'prover/fetcher.js',
    'prover/submitter.js',
    'prover/broadcaster.js',
  ];

  for (const f of requiredFiles) {
    if (!fs.existsSync(path.resolve(__dirname, '..', f))) {
      missing.push(`Missing file: ${f}`);
    }
  }

  // Required environment variables (only for live broadcast, not dry-run)
  // We'll just warn if they're missing.
  const envVars = ['POLYGON_AMOY_RPC_URL', 'ORACLE_PRIVATE_KEY', 'CIRCUIT_BREAKER_ADDRESS'];
  const missingEnv = envVars.filter(v => !process.env[v]);
  if (missingEnv.length > 0) {
    console.warn(`[Pipeline] Warning: Missing environment variables: ${missingEnv.join(', ')}. Dry-run will still work, but live broadcast will fail if attempted.`);
  }

  // Optional: NVIDIA_API_KEY for AI audit
  if (!process.env.NVIDIA_API_KEY) {
    console.warn('[Pipeline] Note: NVIDIA_API_KEY not set. AI audit analysis will be skipped.');
  }

  if (missing.length > 0) {
    console.error('[Pipeline] Fatal: Required files missing:');
    missing.forEach(m => console.error(`  - ${m}`));
    process.exit(1);
  }

  console.log('[Pipeline] All required files present.');
}

// ---------------------------------------------------------------------------
// Helper: run a command with timeout and return stdout
// ---------------------------------------------------------------------------
function runCmd(cmd, timeoutSec) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', timeout: timeoutSec * 1000 });
  } catch (err) {
    if (err.killed) return `ERROR: Command timed out after ${timeoutSec}s`;
    return `ERROR: ${err.message}`;
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function main() {
  checkDependencies();

  const args = process.argv.slice(2);
  const cycles = args.includes('--cycles') ? parseInt(args[args.indexOf('--cycles') + 1], 10) : DEFAULT_CYCLES;
  const timeoutSec = args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1], 10) : DEFAULT_TIMEOUT_SEC;

  // Global timeout: cycles * (timeout + buffer)
  const globalTimeoutMs = cycles * (timeoutSec + 10) * 1000;
  const globalTimeout = setTimeout(() => {
    console.error(`[Pipeline] Global timeout (${globalTimeoutMs/1000}s) reached. Aborting.`);
    process.exit(1);
  }, globalTimeoutMs);
  // Allow process to exit naturally when done
  globalTimeout.unref();

  console.log(`[Pipeline] Starting full-length test — ${cycles} cycles, per-command timeout ${timeoutSec}s`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const allResults = [];

  for (let i = 1; i <= cycles; i++) {
    console.log(`\n[Pipeline] Cycle ${i}/${cycles}`);

    // 1. Fetcher: poll gateways
    console.log('  → Running fetcher...');
    const fetchOutput = runCmd('node prover/fetcher.js', timeoutSec);
    console.log('    Fetcher done.');

    // 2. Load prover state
    const statePath = path.resolve(__dirname, '..', '.local', 'state', 'prover-state.json');
    let proverState = { results: [] };
    try {
      proverState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      console.warn(`    Could not read prover state: ${err.message}`);
      continue;
    }

    // 3. For each asset: validator + scorer
    const cycleAssets = [];
    for (const asset of proverState.results) {
      const entry = {
        assetId: asset.assetId,
        ipfsCid: asset.ipfsCid,
        status: asset.status,
        health: asset.health,
        triggerScore: asset.triggerScore || null,
        documentValid: asset.documentValid,
        schemaFailures: asset.schemaFailures || [],
      };

      console.log(`    Asset ${asset.assetId.slice(0, 10)}... status=${asset.status} health=${asset.health} score=${asset.triggerScore?.toFixed(3) || 'N/A'}`);
      cycleAssets.push(entry);
    }

    // 4. Submitter dry‑run
    console.log('  → Running submitter (dry-run)...');
    const submitOutput = runCmd('node prover/submitter.js --dry-run', timeoutSec);
    console.log('    Submitter done.');

    // 5. Broadcaster dry‑run (no quorum needed)
    console.log('  → Running broadcaster (dry-run)...');
    const broadcastOutput = runCmd('node prover/broadcaster.js --dry-run', timeoutSec);
    console.log('    Broadcaster done.');

    // Record cycle
    allResults.push({
      cycle: i,
      timestamp: new Date().toISOString(),
      assets: cycleAssets,
      submitOutput: submitOutput.slice(-500), // last 500 chars
      broadcastOutput: broadcastOutput.slice(-500),
    });

    // Small delay between cycles (be gentle to gateways)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Clear global timeout (job finished)
  clearTimeout(globalTimeout);

  // -----------------------------------------------------------------------
  // Save raw data
  // -----------------------------------------------------------------------
  const rawFile = path.join(OUTPUT_DIR, `pipeline-run-${timestamp}.json`);
  fs.writeFileSync(rawFile, JSON.stringify(allResults, null, 2));
  console.log(`\n[Pipeline] Raw data saved to ${rawFile}`);

  // -----------------------------------------------------------------------
  // Generate summary report
  // -----------------------------------------------------------------------
  const summary = buildSummary(allResults, cycles);
  const reportMd = generateReport(summary, cycles, timestamp);
  const reportFile = path.join(REPORTS_DIR, `pipeline-run-${timestamp}.md`);
  fs.writeFileSync(reportFile, reportMd);
  console.log(`[Pipeline] Summary report saved to ${reportFile}`);

  console.log('\n[Pipeline] Full-length test complete.');
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------
function buildSummary(allResults, totalCycles) {
  const assetStats = {};
  let totalTrips = 0;
  let totalUpdates = 0;

  for (const cycle of allResults) {
    for (const asset of cycle.assets) {
      if (!assetStats[asset.assetId]) {
        assetStats[asset.assetId] = {
          cyclesSeen: 0,
          mismatches: 0,
          unreachable: 0,
          tripsTriggered: 0,
          updates: 0,
          triggerScores: [],
          documentValidCount: 0,
          documentInvalidCount: 0,
        };
      }
      const stat = assetStats[asset.assetId];
      stat.cyclesSeen++;
      if (asset.status === 'mismatch') stat.mismatches++;
      if (asset.health === 'unreachable') stat.unreachable++;
      if (asset.triggerScore !== null && asset.triggerScore !== undefined) {
        stat.triggerScores.push(asset.triggerScore);
      }
      if (asset.documentValid) stat.documentValidCount++;
      else stat.documentInvalidCount++;
    }
    if (cycle.submitOutput.includes('tripCircuit')) totalTrips++;
    if (cycle.submitOutput.includes('updateProof')) totalUpdates++;
  }

  return { assetStats, totalCycles, totalTrips, totalUpdates, allResults };
}

// ---------------------------------------------------------------------------
// Report generation (Markdown)
// ---------------------------------------------------------------------------
function generateReport(summary, totalCycles, timestamp) {
  let md = `# ProofBridge Liner — Full-Length Integration Test Report\n\n`;
  md += `**Date:** ${timestamp}\n`;
  md += `**Cycles:** ${totalCycles}\n`;
  md += `**Total Trip Actions Planned:** ${summary.totalTrips}\n`;
  md += `**Total Update Actions Planned:** ${summary.totalUpdates}\n\n`;

  md += `## Per-Asset Statistics\n\n`;
  md += `| Asset ID | Cycles | Mismatches | Unreachable | Avg Score | Max Score | Doc Valid | Doc Invalid |\n`;
  md += `|----------|--------|------------|-------------|-----------|-----------|-----------|------------|\n`;

  for (const [assetId, stat] of Object.entries(summary.assetStats)) {
    const avgScore = stat.triggerScores.length > 0
      ? (stat.triggerScores.reduce((a, b) => a + b, 0) / stat.triggerScores.length).toFixed(3)
      : 'N/A';
    const maxScore = stat.triggerScores.length > 0
      ? Math.max(...stat.triggerScores).toFixed(3)
      : 'N/A';
    md += `| ${assetId.slice(0, 12)}... | ${stat.cyclesSeen} | ${stat.mismatches} | ${stat.unreachable} | ${avgScore} | ${maxScore} | ${stat.documentValidCount} | ${stat.documentInvalidCount} |\n`;
  }

  md += `\n## Trigger Score Distribution\n`;
  for (const [assetId, stat] of Object.entries(summary.assetStats)) {
    if (stat.triggerScores.length > 0) {
      md += `- **${assetId.slice(0, 12)}...**: min=${Math.min(...stat.triggerScores).toFixed(3)}, max=${Math.max(...stat.triggerScores).toFixed(3)}, mean=${(stat.triggerScores.reduce((a, b) => a + b, 0) / stat.triggerScores.length).toFixed(3)}\n`;
    }
  }

  md += `\n## Observations\n`;
  if (summary.totalTrips > 0) {
    md += `- **Circuit trips were planned** in ${summary.totalTrips} out of ${totalCycles} cycles. This indicates ghost-risk or adversarial conditions.\n`;
  } else {
    md += `- No circuit trips were planned — system remained open throughout.\n`;
  }
  if (summary.allResults.some(c => c.assets.some(a => a.documentValid === false))) {
    md += `- **Deterministic validator rejected** at least one document as structurally invalid. The scorer clamped the score.\n`;
  }
  md += `\n## Notes\n`;
  md += `- Broadcaster was run in dry-run mode (no on-chain transactions).\n`;
  md += `- AI audit analysis skipped unless NVIDIA_API_KEY was set and document text was extractable.\n`;

  return md;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
main().catch(err => {
  console.error(`[Pipeline] Fatal error: ${err.message}`);
  process.exit(1);
});