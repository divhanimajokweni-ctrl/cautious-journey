#!/usr/bin/env bash
# deploy/extract_addresses.sh — parse forge broadcast JSON and emit contract addresses
# Usage: extract_addresses.sh [engine.json] [oracle.json]
# If no args given, picks up latest broadcast artefacts from out/ silently.

source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"

ENGINE_JSON="${1:-}"
ORACLE_JSON="${2:-}"

# Auto-detect latest broadcast artefactd if not passed
_auto_path() {
  local pattern="$1"
  local best
  best=$(ls -t $pattern 2>/dev/null | head -n 1)
  echo "${best:?No broadcast artifact found matching: $pattern}"
}

[[ -z "$ENGINE_JSON" ]] && ENGINE_JSON="$(_auto_path 'out/DeployUbuntuPoolsEngine.s.sol/*/run-*.json')"
[[ -z "$ORACLE_JSON" ]]    && ORACLE_JSON="$(_auto_path 'out/DeployRiskOracleVerifier.s.sol/*/run-*.json')"

require_env jq

log_info "Extracting addresses from:"
log_info "  Engine : $ENGINE_JSON"
log_info "  Oracle : $ORACLE_JSON"

POOLS_ENGINE_ADDRESS=$(
  jq -r '[.transactions[]?.contractAddress // empty] | map(select(test("^0x"))) | last // "0x"' \
    "$ENGINE_JSON")
ORACLE_ADDRESS=$(
  jq -r '[.transactions[]?.contractAddress // empty] | map(select(test("^0x"))) | last // "0x"' \
    "$ORACLE_JSON")

[[ "$POOLS_ENGINE_ADDRESS" == "0x" || -z "$POOLS_ENGINE_ADDRESS" ]] && \
  log_fatal "Could not extract POOLS_ENGINE_ADDRESS from $ENGINE_JSON"

[[ "$ORACLE_ADDRESS" == "0x" || -z "$ORACLE_ADDRESS" ]] && \
  log_warn  "Could not extract ORACLE_ADDRESS (oracle may not be deployed yet)"

export POOLS_ENGINE_ADDRESS
export ORACLE_ADDRESS

log_success "Contract addresses resolved:"
echo "  POOLS_ENGINE_ADDRESS=$POOLS_ENGINE_ADDRESS"
echo "  ORACLE_ADDRESS=$ORACLE_ADDRESS"
