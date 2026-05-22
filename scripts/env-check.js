#!/usr/bin/env node
// scripts/env-check.js
// ProofBridge Liner — production env var validator
// Run before any deploy: node scripts/env-check.js
// Used by: npm run predeploy

const required = [
  // Deploy & signing — one of the two key names must be set
  "DEPLOYER_PRIVATE_KEY",   // primary Vercel env var name
  "PRIVATE_KEY",             // accepted as fallback alias
  "ORACLE_PRIVATE_KEY",
  "ORACLE_PUBLIC_KEY",
  // Request signing
  "PROOFBRIDGE_HMAC_SECRET",
  // Network & verification
  "POLYGON_AMOY_RPC_URL",
  "POLYGONSCAN_API_KEY",
  // Banking execution
  "STITCH_CLIENT_ID",
  "STITCH_CLIENT_SECRET",
  "STITCH_SECRET",
  // Deployed contract addresses (can be empty on first deploy)
  "POOLS_ENGINE_ADDRESS",
  "CONTRACT_ADDRESS",
];

// ── Determine which deploy key is present ──────────────────────────────────────
const activeKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

// ── Determine which are truly missing (treat DEPLOYER_PRIVATE_KEY / PRIVATE_KEY as one slot) ──
const keyAliasPair = new Set(["DEPLOYER_PRIVATE_KEY", "PRIVATE_KEY"]);

let missing = [];
for (const v of required) {
  if (keyAliasPair.has(v)) {
    if (!activeKey) missing.push("DEPLOYER_PRIVATE_KEY (or PRIVATE_KEY)");
    continue;
  }
  if (!process.env[v] || String(process.env[v]).trim() === "") {
    missing.push(v);
  }
}

// ── Contract addresses may be empty on first deploy ────────────────────────────
const deferred = new Set(["POOLS_ENGINE_ADDRESS", "CONTRACT_ADDRESS"]);
const hardMissing = missing.filter(v => !deferred.has(v));
const deferredEmpty = missing.filter(v => deferred.has(v));

// ── Guard ──────────────────────────────────────────────────────────────────────
if (hardMissing.length) {
  console.error("\n❌  Deploy blocked — missing required env vars:\n");
  hardMissing.forEach(v => console.error(`   • ${v}`));
  console.error("\n   Set via Vercel dashboard: Settings → Environment Variables → Production\n");
  process.exit(1);
}

// ── Success report ─────────────────────────────────────────────────────────────
function mask(val, minChars = 4) {
  const s = String(val);
  return s.length > 6 ? s.slice(0, 6) + "..." + s.slice(-minChars) : "***";
}

function keyLabel(v) {
  if (v === "DEPLOYER_PRIVATE_KEY") return activeKey && process.env.DEPLOYER_PRIVATE_KEY ? v : v + " (via PRIVATE_KEY)";
  return v;
}

console.log("\n✅  All required env vars present:");
for (const v of required) {
  const val = process.env[v];
  if (!val || String(val).trim() === "") {
    console.log(`   ⎳  ${keyLabel(v).padEnd(35)} (empty — pipeline will fill)`);
  } else {
    console.log(`   ✓   ${keyLabel(v).padEnd(35)} ${mask(val)}`);
  }
}
if (deferredEmpty.length) {
  console.log("\n   ⓘ  POOLS_ENGINE_ADDRESS and CONTRACT_ADDRESS will be auto-written by the deploy pipeline.\n");
} else {
  console.log("");
}
process.exit(0);
