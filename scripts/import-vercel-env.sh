#!/usr/bin/env bash

set -euo pipefail

# -----------------------------
# Config
# -----------------------------
PROJECT_NAME="proofbridge-liner"
ENVIRONMENT="production"

# Required variables (will validate)
REQUIRED_VARS=(
  PROOFBRIDGE_HMAC_SECRET
  ORACLE_PRIVATE_KEY
  ORACLE_PUBLIC_KEY
  CONTRACT_ADDRESS
  STITCH_CLIENT_ID
  STITCH_CLIENT_SECRET
  STITCH_SECRET
  POOLS_ENGINE_ADDRESS
)

# -----------------------------
# Helpers
# -----------------------------

function require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "❌ Missing required variable: $name"
    exit 1
  fi
}

function upsert_env() {
  local key="$1"
  local value="$2"

  echo "➡️ Setting $key..."

  # Remove existing (ignore errors)
  vercel env rm "$key" "$ENVIRONMENT" --yes >/dev/null 2>&1 || true

  # Add new value
  printf "%s" "$value" | vercel env add "$key" "$ENVIRONMENT" >/dev/null

  echo "✅ $key set"
}

# -----------------------------
# Validation
# -----------------------------

echo "🔍 Validating required environment variables..."

for var in "${REQUIRED_VARS[@]}"; do
  require_var "$var"
done

echo "✅ All required variables present"

# -----------------------------
# Import Variables
# -----------------------------

echo "🚀 Importing environment variables into Vercel ($ENVIRONMENT)..."

upsert_env PROOFBRIDGE_HMAC_SECRET "$PROOFBRIDGE_HMAC_SECRET"
upsert_env ORACLE_PRIVATE_KEY "$ORACLE_PRIVATE_KEY"
upsert_env ORACLE_PUBLIC_KEY "$ORACLE_PUBLIC_KEY"
upsert_env CONTRACT_ADDRESS "$CONTRACT_ADDRESS"
upsert_env STITCH_CLIENT_ID "$STITCH_CLIENT_ID"
upsert_env STITCH_CLIENT_SECRET "$STITCH_CLIENT_SECRET"
upsert_env STITCH_SECRET "$STITCH_SECRET"
upsert_env POOLS_ENGINE_ADDRESS "$POOLS_ENGINE_ADDRESS"

echo "🎉 All environment variables successfully imported!"

# -----------------------------
# Verification
# -----------------------------

echo "🔎 Verifying variables..."

vercel env ls "$ENVIRONMENT"

echo "✅ Verification complete"