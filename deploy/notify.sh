#!/usr/bin/env bash
# deploy/notify.sh — Slack / Telegram notification dispatcher
# Usage: notify "message body"
#        notify "subject" "detail body"

source "$(dirname "${BASH_SOURCE[0]}")/config.sh" 2>/dev/null || true
source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"  2>/dev/null || true

notify() {
  local subject="${1:-Deploy event}"
  local body="${2:-}"

  if [[ -n "$body" ]]; then
    local text="$subject

$body"
  else
    local text="$subject"
  fi

  # ---- Slack ----
  if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
    curl -s -X POST \
      -H 'Content-type: application/json' \
      --data "$(printf '{"text":"%s"}' "$text")" \
      "$SLACK_WEBHOOK" > /dev/null 2>&1 \
      && log_info "Slack notification sent" \
      || log_warn  "Slack notification failed"
  fi

  # ---- Telegram ----
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" \
      -d text="$text" > /dev/null 2>&1 \
      && log_info "Telegram notification sent" \
      || log_warn  "Telegram notification failed"
  fi

  # ---- stdout fallback (always fire) ----
  echo -e "\n===== NOTIFICATION =====\n$text\n===== END NOTIFICATION =====\n" | tee -a "$LOG_FILE"
}
