#!/usr/bin/env bash
# deploy/rollback.sh — restore last known-good contract / Vercel env state
# Loads last_successful.env (saved by full_auto_deploy.sh) and restores Vercel env + contract references.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"
source "$(dirname "${BASH_SOURCE[0]}")/notify.sh"

SNAPSHOT_FILE="${1:-last_successful.env}"
SNAPSHOT_DIR="$PWD/deploy/snapshots"
LATEST_SNAPSHOT=""

# ── Find most recent snapshot ───────────────────────────────────────────────────
find_snapshot() {
  local found
  found=$(ls -t "$SNAPSHOT_DIR"/rollback_*.env 2>/dev/null | head -n 1)
  if [[ -z "$found" ]]; then
    [[ -f "$SNAPSHOT_FILE" ]] && found="$SNAPSHOT_FILE"
  fi
  echo "${found:?}"
}

# ── Restore env vars into Vercel via API ──────────────────────────────────────
restore_vercel_env() {
  local key="$1" value="$2"
  if [[ -z "${VERCEL_TOKEN:-}" || -z "${VERCEL_PROJECT_ID:-}" ]]; then
    log_warn "VERCEL_TOKEN / VERCEL_PROJECT_ID not set — skipping Vercel env restore for $key"
    return 0
  fi
  curl -s -X POST \
    "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID:-}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$key\",\"value\":\"$value\",\"target\":[\"production\"]}" > /dev/null \
    && log_info  "Vercel env restored: $key=$value" \
    || log_warn   "Vercel env restore failed for $key"
}

# ── Main ───────────────────────────────────────────────────────────────────────
log_warn "=== ROLLBACK INITIATED ==="

SNAPSHOT_FILE="$(find_snapshot)"
log_info "Using snapshot: $SNAPSHOT_FILE"

if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  log_fatal "No rollback snapshot found. Place last_successful.env in $PWD or $SNAPSHOT_DIR/"
fi

# reload snapshot
source "$SNAPSHOT_FILE"

# Restore each LIVE_ env var back to Vercel
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  restore_vercel_env "$key" "$value"
done < "$SNAPSHOT_FILE"

notify "ROLLBACK COMPLETE" "Restored from: $SNAPSHOT_FILE

$(cat "$SNAPSHOT_FILE")"

log_success "=== ROLLBACK COMPLETE ==="
