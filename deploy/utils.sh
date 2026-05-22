#!/usr/bin/env bash
# deploy/utils.sh — retry + structured logging (source after config.sh)

source "$(dirname "${BASH_SOURCE[0]}")/config.sh" 2>/dev/null || true

export LOG_FILE="${LOG_FILE:-deploy/logs/deploy_$(date +%Y%m%d_%H%M%S).log}"

# ── Structured logging ──────────────────────────────────────────────────────────
log() {
  local level="${2:-INFO}"
  local msg="[$(date '+%Y-%m-%dT%H:%M:%S')] [$level] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

log_info()    { log "$1" "INFO";   }
log_warn()    { log "$1" "WARN";   }
log_error()   { log "$1" "ERROR";  }
log_success() { log "$1" "OK";     }
log_fatal()   { log "$1" "FATAL"
                 tail -30 "$LOG_FILE" 2>/dev/null || true
                 exit 1;            }

# ── Retry helper ───────────────────────────────────────────────────────────────
retry() {
  local n=1
  local attempt
  while true; do
    set +e
    "$@"
    local rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      return 0
    fi
    attempt="$n"
    log_warn "Command failed with exit $rc — attempt $attempt/$MAX_RETRIES"
    if [[ $n -ge $MAX_RETRIES ]]; then
      log_error "Command failed permanently after $MAX_RETRIES attempts"
      return 1
    fi
    n=$((n + 1))
    log_info "Sleeping ${SLEEP_BETWEEN_RETRIES}s before retry $n/$MAX_RETRIES"
    sleep "$SLEEP_BETWEEN_RETRIES"
  done
}

# ── Guard: must have required env var ──────────────────────────────────────────
require_env() {
  local missing=()
  for var in "$@"; do
    [[ -z "${!var:-}" ]] && missing+=("$var")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_fatal "Missing required env vars: ${missing[*]}"
  fi
}

# ── Result pretty-print ─────────────────────────────────────────────────────────
pass()  { log_success "$1"; return 0; }
fail()  { log_error   "$1"; return 1; }
