#!/usr/bin/env node
/**
 * scripts/deploy.js
 * ProofBridge Liner — Foundry deployment runner
 *
 * Usage:
 *   node scripts/deploy.js [--target cb|full] [--dry-run] [--rpc <url>]
 *
 * Targets:
 *   cb    Deploy CircuitBreaker only (Phase 2 MVP)
 *   full  Deploy CircuitBreaker + AssetRegistry + TEEVerifier (default)
 *
 * Required env vars:
 *   PRIVATE_KEY              Deployer private key (0x-prefixed)
 *   POLYGON_AMOY_RPC_URL     RPC endpoint
 *   ORACLE_ADDRESS           Single-oracle address (for CircuitBreaker)
 *   ENCLAVE_ADDRESS          TEE enclave public key — address form (full only)
 *
 * On success writes deployed addresses to .env.deployed and prints a summary.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const FORGE  = path.join(ROOT, '.config', '.foundry', 'bin', 'forge');

const SCRIPTS = {
  cb:   'script/DeployCircuitBreaker.s.sol:DeployCircuitBreaker',
  full: 'script/DeployFull.s.sol:DeployFull',
};

const ADDRESS_PATTERNS = {
  CircuitBreaker: /CircuitBreaker\s*(?:deployed at)?:\s*(0x[0-9a-fA-F]{40})/,
  AssetRegistry:  /AssetRegistry\s*:\s*(0x[0-9a-fA-F]{40})/,
  TEEVerifier:    /TEEVerifier\s*:\s*(0x[0-9a-fA-F]{40})/,
};

// ─── Argument parsing ────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag  = (f)     => argv.includes(f);
const param = (f, d)  => { const i = argv.indexOf(f); return i !== -1 ? argv[i + 1] : d; };

const target = param('--target', 'full');
const dryRun = flag('--dry-run') || flag('--simulate');
const rpcUrl = param('--rpc', process.env.POLYGON_AMOY_RPC_URL || '');

if (!SCRIPTS[target]) {
  die(`Unknown target "${target}". Use --target cb or --target full.`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function die(msg) {
  console.error(`\n[deploy] ERROR: ${msg}\n`);
  process.exit(1);
}

function ok(msg)   { console.log(`  ✔  ${msg}`); }
function info(msg) { console.log(`  ·  ${msg}`); }
function step(msg) { console.log(`\n[deploy] ${msg}`); }

function hr() { console.log('\n' + '─'.repeat(62)); }

// ─── Pre-flight checks ───────────────────────────────────────────────────────

step('Pre-flight checks');

if (!fs.existsSync(FORGE)) {
  die(
    `forge not found at ${FORGE}.\n` +
    '  Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup\n' +
    '  Or run the project setup once to install it locally.'
  );
}
ok(`forge found at ${FORGE}`);

const required = ['PRIVATE_KEY', 'POLYGON_AMOY_RPC_URL', 'ORACLE_ADDRESS'];
if (target === 'full') required.push('ENCLAVE_ADDRESS');

const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  die(
    `Missing required environment variables:\n` +
    missing.map(v => `    • ${v}`).join('\n') + '\n\n' +
    '  Set them in Replit Secrets (or export them locally) before deploying.'
  );
}
ok(`All required env vars present (${required.join(', ')})`);

if (!rpcUrl) die('POLYGON_AMOY_RPC_URL is empty.');
ok(`RPC: ${rpcUrl.replace(/\/\/.+@/, '//***@')}`);

// ─── Build (compile) ─────────────────────────────────────────────────────────

step('Compiling contracts');

const buildResult = spawnSync(
  FORGE, ['build', '--silent'],
  { cwd: ROOT, encoding: 'utf8', env: process.env }
);

if (buildResult.status !== 0) {
  console.error(buildResult.stderr);
  die('forge build failed. Fix compilation errors first.');
}
ok('All contracts compiled successfully');

// ─── Deploy ───────────────────────────────────────────────────────────────────

const scriptPath = SCRIPTS[target];
step(`Deploying: ${scriptPath} ${dryRun ? '(DRY-RUN / simulate)' : 'to Polygon Amoy'}`);

const forgeArgs = [
  'script', scriptPath,
  '--rpc-url', rpcUrl,
  '--private-key', process.env.PRIVATE_KEY,
  '-vvv',
];

if (!dryRun) {
  forgeArgs.push('--broadcast');
  info('Broadcasting transactions on-chain (--broadcast)');
} else {
  info('Simulating only — no transactions will be sent');
}

info(`Running: forge ${forgeArgs.filter(a => a !== process.env.PRIVATE_KEY).join(' ')}`);

const deployResult = spawnSync(FORGE, forgeArgs, {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    ORACLE_ADDRESS:  process.env.ORACLE_ADDRESS,
    ENCLAVE_ADDRESS: process.env.ENCLAVE_ADDRESS || '',
  },
  maxBuffer: 4 * 1024 * 1024,
});

const stdout = deployResult.stdout || '';
const stderr = deployResult.stderr || '';
const combined = stdout + '\n' + stderr;

if (deployResult.status !== 0) {
  console.error('\n── forge output ──────────────────────────────────────');
  console.error(combined);
  die('forge script failed. See output above.');
}

console.log('\n── forge output ──────────────────────────────────────');
console.log(combined.trim());

// ─── Parse addresses ─────────────────────────────────────────────────────────

step('Parsing deployed addresses');

const deployed = {};
for (const [name, pattern] of Object.entries(ADDRESS_PATTERNS)) {
  const m = combined.match(pattern);
  if (m) {
    deployed[name] = m[1];
    ok(`${name.padEnd(18)} ${m[1]}`);
  }
}

if (!Object.keys(deployed).length) {
  info('No addresses parsed (simulation may not emit them — check forge output above)');
}

// ─── Write .env.deployed ─────────────────────────────────────────────────────

if (!dryRun && Object.keys(deployed).length) {
  step('Writing .env.deployed');

  const envLines = [
    `# ProofBridge Liner — deployed addresses`,
    `# Generated by scripts/deploy.js on ${new Date().toISOString()}`,
    `# Network: Polygon Amoy (chainId 80002)`,
    '',
  ];

  if (deployed.CircuitBreaker)  envLines.push(`CIRCUIT_BREAKER_ADDRESS=${deployed.CircuitBreaker}`);
  if (deployed.AssetRegistry)   envLines.push(`ASSET_REGISTRY_ADDRESS=${deployed.AssetRegistry}`);
  if (deployed.TEEVerifier)     envLines.push(`TEE_VERIFIER_ADDRESS=${deployed.TEEVerifier}`);
  if (process.env.ORACLE_ADDRESS)   envLines.push(`ORACLE_ADDRESS=${process.env.ORACLE_ADDRESS}`);
  if (process.env.ENCLAVE_ADDRESS)  envLines.push(`ENCLAVE_ADDRESS=${process.env.ENCLAVE_ADDRESS}`);
  envLines.push('');

  const envFile = path.join(ROOT, '.env.deployed');
  fs.writeFileSync(envFile, envLines.join('\n'));
  ok(`.env.deployed written to ${envFile}`);
  info('Copy these values into Replit Secrets so the dashboard picks them up.');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

hr();
console.log('\n  DEPLOYMENT SUMMARY\n');
console.log(`  Target   : ${target === 'full' ? 'Full suite (CB + Registry + TEE)' : 'CircuitBreaker only'}`);
console.log(`  Mode     : ${dryRun ? 'Simulate (dry-run)' : 'Live broadcast'}`);
console.log(`  Network  : Polygon Amoy (chainId 80002)`);
console.log(`  RPC      : ${rpcUrl.replace(/\/\/.+@/, '//***@')}`);
console.log('');

if (Object.keys(deployed).length) {
  for (const [name, addr] of Object.entries(deployed)) {
    const scanUrl = `https://amoy.polygonscan.com/address/${addr}`;
    console.log(`  ${name.padEnd(18)} ${addr}`);
    console.log(`  ${''.padEnd(18)} ${scanUrl}`);
    console.log('');
  }
} else {
  console.log('  No addresses extracted (check forge output above)');
}

if (!dryRun) {
  console.log('  Next steps:');
  console.log('  1. Copy addresses from .env.deployed into Replit Secrets');
  console.log('  2. Restart the dashboard (npm run start) to reflect new addresses');
  if (target === 'full') {
    console.log('  3. Call AssetRegistry.registerAsset() for each monitored deed');
    console.log('  4. Run node prover/submitter.js to push first proof hashes');
  }
}

hr();
console.log('');
