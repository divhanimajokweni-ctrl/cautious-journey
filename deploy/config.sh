#!/usr/bin/env bash
# deploy/config.sh — single source of truth for all deployment config
# Source this first: `source deploy/config.sh`

set -euo pipefail

# ===== NETWORK CONFIG =====
export NETWORK="${NETWORK:-amoy}"

case "${NETWORK,,}" in
  amoy)
    export RPC_URL="${POLYGON_AMOY_RPC_URL:-https://rpc-amoy.polygon.technology}"
    export CHAIN_ID=80002
    export ETHERSCAN_URL="https://api-amoy.polygonscan.com/api"
    export EXPLORER="https://amoy.polygonscan.com"
    ;;
  polygon|mainnet)
    export RPC_URL="${POLYGON_MAINNET_RPC_URL:-https://polygon-rpc.com}"
    export CHAIN_ID=137
    export ETHERSCAN_URL="https://api.polygonscan.com/api"
    export EXPLORER="https://polygonscan.com"
    ;;
  *)
    echo "[$(date '+%H:%M:%S')] ❌ Unknown network: $NETWORK (use amoy | polygon)" | tee -a "$LOG_FILE"
    exit 1
    ;;
esac

# ===== RETRY CONFIG =====
: "${MAX_RETRIES:=3}"
: "${SLEEP_BETWEEN_RETRIES:=5}"

# ===== LOGGING =====
export LOG_FILE="${LOG_FILE:-deploy/logs/deploy_$(date +%Y%m%d_%H%M%S).log}"
mkdir -p "$(dirname "$LOG_FILE")"

# ===== DEPLOYER KEY =====
# PRIVATE_KEY: foundry forge deploy key (POWERS forge broadcast)
# ORACLE_PRIVATE_KEY: EIP-712 signing key for v2/decision
: "${PRIVATE_KEY:=}"
: "${ORACLE_PRIVATE_KEY:=${PRIVATE_KEY:-}}"

# ===== CHAIN-SCOPED ENV =====
# Circle  ← Polygon Amoy (testnet)
# Circle  ← Polygon mainnet (prod)
export CHAIN_SCOPE="${NETWORK^^}"   # AMOY | POLYGON
