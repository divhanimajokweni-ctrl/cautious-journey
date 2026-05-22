#!/usr/bin/env bash
# deploy/full_auto_deploy.sh — production-grade automated deploy
# Pipeline: validate → build → deploy contracts → extract → verify → Vercel env → Vercel prod deploy → tag → notify
#
# Required env vars (never commit — all from Vercel dashboard / GitHub Secrets):
#   DEPLOYER_PRIVATE_KEY        forge broadcast signing key (PRIVATE_KEY alias supported)
#   ORACLE_PRIVATE_KEY           EIP-712 signing key (defaults to DEPLOYER_PRIVATE_KEY)
#   ORACLE_PUBLIC_KEY            EIP-712 verifying contract public key
#   PROOFBRIDGE_HMAC_SECRET      JWT signing + response-signing secret
#   POLYGON_AMOY_RPC_URL         Amoy RPC endpoint
#   POLYGONSCAN_API_KEY          Etherscan API key for contract verification
#   STITCH_CLIENT_ID             Stitch Money OAuth2 client ID
#   STITCH_CLIENT_SECRET         Stitch Money OAuth2 client secret
#   STITCH_SECRET                Svix/Stitch webhook HMAC verification
#   POOLS_ENGINE_ADDRESS         UbuntuPoolsEngine on Amoy (filled by pipeline on first deploy)
#   CONTRACT_ADDRESS             RiskOracleVerifier on Amoy (filled by pipeline on first deploy)
#   VERCEL_TOKEN                 Vercel API token (for env sync + prod deploy)
#   VERCEL_PROJECT_ID            Vercel project ID
#   VERCEL_ORG_ID                Vercel team/org ID
#   VERCEL_APP_CLIENT_SECRET     Vercel OAuth token exchange
#   SLACK_WEBHOOK                (optional) Slack incoming webhook
#   TELEGRAM_BOT_TOKEN           (optional)
#   TELEGRAM_CHAT_ID             (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/notify.sh"

# ⛔ GATE — reset blocked key to zero before anything else
if [[ "$PRIVATE_KEY" =~ ^0xb259 ]]; then
  log_fatal "EXPOSED KEY DETECTED in PRIVATE_KEY — aborting. Rotate immediately."
fi
if [[ "${ORACLE_PRIVATE_KEY:-${PRIVATE_KEY:-}}" =~ ^0xb259 ]]; then
  log_fatal "EXPOSED KEY DETECTED in ORACLE_PRIVATE_KEY — aborting. Rotate immediately."
fi

log_info "=== PRODUCTION DEPLOY START [NETWORK=$NETWORK CHAIN=$CHAIN_ID] ==="

# ── 0. Pre-flight checks ───────────────────────────────────────────────────────
require_env PRIVATE_KEY VERCEL_TOKEN VERCEL_PROJECT_ID POLYGON_AMOY_RPC_URL POLYGONSCAN_API_KEY \
            PROOFBRIDGE_HMAC_SECRET ORACLE_PUBLIC_KEY CONTRACT_ADDRESS \
            STITCH_CLIENT_ID STITCH_CLIENT_SECRET STITCH_SECRET

# Verify tools present
for tool in forge npx node jq; do
  command -v "$tool" >/dev/null 2>&1 || log_fatal "Required tool not found: $tool"
done

# ── 1. Deployer address for context ───────────────────────────────────────────
log_info "Deployer PRIVATE_KEY prefix: ${PRIVATE_KEY:0:6}...${PRIVATE_KEY:(-4)}"
log_info "Network: $NETWORK  Chain: $CHAIN_ID  RPC: $RPC_URL"

# ── 2. Build ──────────────────────────────────────────────────────────────────
log_info "Step 1/6: Building contracts"
retry forge build
log_success "Build passed"

# ── 3. Deploy UbuntuPoolsEngine ───────────────────────────────────────────────
log_info "Step 2/6: Deploying UbuntuPoolsEngine"
ENGINE_JSON="$PWD/deploy/logs/engine_$(date +%s).json"

retry forge script "$SCRIPT_DIR/../script/DeployUbuntuPoolsEngine.s.sol" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast --json > "$ENGINE_JSON" \
  && log_success "UbuntuPoolsEngine broadcast complete" \
  || log_fatal  "UbuntuPoolsEngine deploy FAILED after $MAX_RETRIES attempts"

# ── 4. Deploy RiskOracleVerifier ──────────────────────────────────────────────
log_info "Step 3/6: Deploying RiskOracleVerifier"
ORACLE_JSON="$PWD/deploy/logs/oracle_$(date +%s).json"

retry forge script "$SCRIPT_DIR/../script/DeployRiskOracleVerifier.s.sol" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast --json > "$ORACLE_JSON" \
  && log_success "RiskOracleVerifier broadcast complete" \
  || log_fatal  "RiskOracleVerifier deploy FAILED after $MAX_RETRIES attempts"

# ── 5. Extract addresses ──────────────────────────────────────────────────────
log_info "Step 4/6: Extracting contract addresses"
bash "$SCRIPT_DIR/extract_addresses.sh" "$ENGINE_JSON" "$ORACLE_JSON"
log_success "Engine: $POOLS_ENGINE_ADDRESS"
log_success "Oracle: $ORACLE_ADDRESS"

# ── 6. Verify on Etherscan ───────────────────────────────────────────────────
log_info "Step 5/7: Submitting contract for verification"

retry forge verify-contract \
  --chain-id "$CHAIN_ID" \
  --etherscan-api-key "$POLYGONSCAN_API_KEY" \
  "$POOLS_ENGINE_ADDRESS" \
  "src/UbuntuPoolsEngine.sol:UbuntuPoolsEngine" \
  || log_warn "Engine verification failed / already verified — continuing"

if command -v cast >/dev/null 2>&1; then
  retry cast balance 0x49A1ba2Bde61B96685385F4Ce012586A518c3E70 --rpc-url "$RPC_URL" \
    && log_success "Deployer balance verified" \
    || log_warn  "Could not verify deployer balance"
fi

# ── 7. Save snapshot for rollback ─────────────────────────────────────────────
SNAPSHOT="$PWD/deploy/snapshots/rollback_$(date +%Y%m%d_%H%M%S).env"
cat > "$SNAPSHOT" <<EOF
POOLS_ENGINE_ADDRESS=${POOLS_ENGINE_ADDRESS}
ORACLE_ADDRESS=${ORACLE_ADDRESS}
CONTRACT_ADDRESS=${CONTRACT_ADDRESS}
EOF
log_info "Rollback snapshot saved: $SNAPSHOT"

# ── 8. Push addresses & secrets to Vercel ────────────────────────────────────
log_info "Step 6/6: Updating Vercel environment variables"

vercel_set_env() {
  local key="$1" value="$2"
  retry curl -s -X POST \
    "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID:-}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$key\",\"value\":\"$value\",\"target\":[\"production\"]}" > /dev/null
}

vercel_set_env "POOLS_ENGINE_ADDRESS"          "$POOLS_ENGINE_ADDRESS"
vercel_set_env "ORACLE_PUBLIC_KEY"             "$ORACLE_ADDRESS"
vercel_set_env "POLYGON_AMOY_RPC_URL"          "$RPC_URL"
vercel_set_env "PROOFBRIDGE_HMAC_SECRET"       "$PROOFBRIDGE_HMAC_SECRET"
vercel_set_env "ORACLE_PRIVATE_KEY"            "$ORACLE_PRIVATE_KEY"
vercel_set_env "STITCH_CLIENT_ID"              "$STITCH_CLIENT_ID"
vercel_set_env "STITCH_CLIENT_SECRET"          "$STITCH_CLIENT_SECRET"
vercel_set_env "STITCH_SECRET"                 "$STITCH_SECRET"

log_success "Vercel env sync complete"

# ── 9. Vercel production deploy ───────────────────────────────────────────────
if command -v vercel >/dev/null 2>&1; then
  log_info "Step 7/7: Deploying to Vercel production"
  retry npx vercel deploy --prod --token "$VERCEL_TOKEN" \
    && log_success "Vercel production deploy complete" \
    || log_fatal "Vercel deploy FAILED"
else
  log_warn "Vercel CLI not found — skipping frontend deploy"
fi

# ── 10. Tag for audit trail ────────────────────────────────────────────────────
VERSION="deploy-${NETWORK}-$(date +%Y%m%d-%H%M%S)"
git tag "$VERSION" >/dev/null 2>&1 && log_info "Git tag: $VERSION"
git push origin "$VERSION" >/dev/null 2>&1 && log_info "Tag pushed" || log_warn "Tag push failed (no remote?)"

# ── 11. Notify ─────────────────────────────────────────────────────────────────
notify "Deploy $VERSION on ${NETWORK^^}" \
"Contract deploy complete on ${NETWORK^^} (chain $CHAIN_ID)

Engine: $POOLS_ENGINE_ADDRESS
Oracle: $ORACLE_ADDRESS
RPC   : $RPC_URL
Tag   : $VERSION"

log_success "=== DEPLOY COMPLETE [$VERSION] ==="
