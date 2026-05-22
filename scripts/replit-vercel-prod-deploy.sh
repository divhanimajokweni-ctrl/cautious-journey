#!/usr/bin/env bash
set -Eeuo pipefail

# Replit -> Vercel production deploy helper for ProofBridge Liner.
#
# This script is intentionally conservative:
# - uses npm/package-lock.json for dependency installation;
# - never echoes secret values;
# - runs Vercel production pull + build before deploy;
# - requires an explicit confirmation variable before live production deploy.
#
# Usage in Replit Shell:
#   export VERCEL_AUTH_TOKEN=...
#   export EXPECTED_GIT_BRANCH=gate-1
#   export EXPECTED_GIT_HEAD=98f1cf3
#   export CONFIRM_PROD_DEPLOY=yes
#   npm run deploy:vercel:replit
#
# Optional:
#   SKIP_NPM_CI=yes npm run deploy:vercel:replit
#   SKIP_TESTS=yes npm run deploy:vercel:replit
#   PRODUCTION_ALIAS_DOMAIN=venturevisionubuntu.co.za npm run deploy:vercel:replit
#   PRODUCTION_HEALTH_URL=https://venturevisionubuntu.co.za/api/health npm run deploy:vercel:replit

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

readonly REQUIRED_PRODUCTION_ENV_NAMES=(
  PROOFBRIDGE_HMAC_SECRET
  ORACLE_PRIVATE_KEY
  ORACLE_PUBLIC_KEY
  CONTRACT_ADDRESS
  STITCH_CLIENT_ID
  STITCH_CLIENT_SECRET
  STITCH_SECRET
  POOLS_ENGINE_ADDRESS
)

readonly EXPECTED_PRIMARY_ALIAS="${EXPECTED_PRIMARY_ALIAS:-proofbridge-liner.vercel.app}"
readonly STALE_ALIASES=(
  proofbridge-liner-divhanimajokweni-1651s-projects.vercel.app
  proofbridge-liner-git-main-divhanimajokweni-1651s-projects.vercel.app
)

log() {
  printf '\n[replit-vercel-prod-deploy] %s\n' "$*"
}

die() {
  printf '\n[replit-vercel-prod-deploy] ERROR: %s\n\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

has_npm_script() {
  node -e "const pkg=require('./package.json'); process.exit(pkg.scripts && pkg.scripts[process.argv[1]] ? 0 : 1)" "$1"
}

redact_present() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf '%s=present\n' "$name"
  else
    printf '%s=missing\n' "$name"
  fi
}

require_env_file_name() {
  local env_file="$1"
  local env_name="$2"
  if ! grep -qE "^${env_name}=" "$env_file"; then
    die "Vercel production env is missing required variable: $env_name"
  fi
}

log "Repository"
pwd

if command -v git >/dev/null 2>&1; then
  git status -sb

  current_branch="$(git branch --show-current)"
  current_head="$(git rev-parse HEAD)"
  current_head_short="$(git rev-parse --short HEAD)"

  printf 'branch=%s\n' "$current_branch"
  printf 'head=%s\n' "$current_head_short"

  [[ -n "${EXPECTED_GIT_BRANCH:-}" ]] || die "EXPECTED_GIT_BRANCH is required"
  [[ -n "${EXPECTED_GIT_HEAD:-}" ]] || die "EXPECTED_GIT_HEAD is required"
  [[ "$current_branch" == "$EXPECTED_GIT_BRANCH" ]] || die "Branch mismatch: expected $EXPECTED_GIT_BRANCH, got $current_branch"
  case "$current_head" in
    "$EXPECTED_GIT_HEAD"*) ;;
    *) die "Commit mismatch: expected prefix $EXPECTED_GIT_HEAD, got $current_head" ;;
  esac

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --porcelain
    die "Dirty worktree. Commit, stash, or discard local changes before production deploy."
  fi
else
  die "git is required for branch, commit, and dirty-tree deploy gates"
fi

log "Runtime versions"
need_cmd node
need_cmd npm
node --version
npm --version

log "Secret presence check"
redact_present VERCEL_AUTH_TOKEN
[[ -n "${VERCEL_AUTH_TOKEN:-}" ]] || die "VERCEL_AUTH_TOKEN is required in Replit Secrets or shell env"

for env_name in "${REQUIRED_PRODUCTION_ENV_NAMES[@]}"; do
  redact_present "$env_name"
done

if [[ "${CONFIRM_PROD_DEPLOY:-}" != "yes" ]]; then
  die "Refusing production deploy. Set CONFIRM_PROD_DEPLOY=yes to continue."
fi

log "Route guard"
[[ -f api/verify.js ]] || die "api/verify.js is missing"
node -e "const fs=require('fs'); const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8')); const ok=(cfg.routes||[]).some(r=>r.src==='/api/health' && r.dest==='/api/verify.js'); process.exit(ok ? 0 : 1)" \
  || die "vercel.json must route /api/health to /api/verify.js"

log "Lockfile check"
if [[ -f package-lock.json ]]; then
  echo "package-lock.json found; using npm ci"
elif [[ -f pnpm-lock.yaml ]]; then
  die "pnpm-lock.yaml found but this script is npm-only for this repo. Review before changing deploy flow."
else
  die "No package-lock.json found. Refusing non-lockfile install for production deploy."
fi

if [[ "${SKIP_NPM_CI:-}" == "yes" ]]; then
  log "Skipping npm ci because SKIP_NPM_CI=yes"
else
  log "Installing dependencies with npm ci"
  npm ci
fi

log "Build verification"
if has_npm_script build; then
  npm run build
elif [[ "${ALLOW_MISSING_BUILD_SCRIPT:-}" == "yes" ]]; then
  log "Missing build script allowed by ALLOW_MISSING_BUILD_SCRIPT=yes"
else
  die "package.json has no build script. Set ALLOW_MISSING_BUILD_SCRIPT=yes only after reviewing Vercel build behavior."
fi

if [[ "${SKIP_TESTS:-}" == "yes" ]]; then
  log "Skipping tests because SKIP_TESTS=yes"
elif has_npm_script test; then
  log "Running tests"
  npm test
else
  die "package.json has no test script. Set SKIP_TESTS=yes only with an explicit release exception."
fi

log "Vercel CLI gate"
VERCEL_BIN="${VERCEL_BIN:-./node_modules/.bin/vercel}"
if [[ ! -x "$VERCEL_BIN" ]]; then
  die "Vercel CLI not found at $VERCEL_BIN. Add a pinned vercel devDependency or set VERCEL_BIN to a trusted executable."
fi
"$VERCEL_BIN" --version

log "Alias guard"
alias_output="$("$VERCEL_BIN" alias ls --token="$VERCEL_AUTH_TOKEN" 2>/dev/null || true)"
if [[ -z "$alias_output" ]]; then
  die "Unable to read Vercel aliases. Confirm token scope before production deploy."
fi
if ! grep -q "$EXPECTED_PRIMARY_ALIAS" <<<"$alias_output"; then
  die "Expected primary alias not found in Vercel aliases: $EXPECTED_PRIMARY_ALIAS"
fi
for stale_alias in "${STALE_ALIASES[@]}"; do
  if grep -q "$stale_alias" <<<"$alias_output"; then
    die "Stale alias still present: $stale_alias. Remove it in Vercel before production deploy."
  fi
done

log "Pulling Vercel production environment"
"$VERCEL_BIN" pull --yes --environment=production --token="$VERCEL_AUTH_TOKEN"

log "Vercel production env-name guard"
if [[ -f .vercel/.env.production.local ]]; then
  for env_name in "${REQUIRED_PRODUCTION_ENV_NAMES[@]}"; do
    require_env_file_name .vercel/.env.production.local "$env_name"
  done

  mapfile -t code_env_names < <(grep -RhoE 'process\.env\.[A-Z0-9_]+' api dashboard server lib 2>/dev/null | sed 's/process\.env\.//' | sort -u)
  for env_name in "${code_env_names[@]}"; do
    case "$env_name" in
      NODE_ENV|DASHBOARD_HOST|DASHBOARD_PORT) continue ;;
    esac
    if ! grep -qE "^${env_name}=" .vercel/.env.production.local; then
      die "Vercel production env is missing code-referenced variable: $env_name"
    fi
  done
else
  die "Vercel production env file was not created by vercel pull"
fi

log "Contract deployment env guard"
require_env_file_name .vercel/.env.production.local CONTRACT_ADDRESS
require_env_file_name .vercel/.env.production.local POOLS_ENGINE_ADDRESS

log "Building Vercel production artifact"
"$VERCEL_BIN" build --prod --token="$VERCEL_AUTH_TOKEN"

log "Deploying prebuilt artifact to Vercel production"
DEPLOYMENT_URL="$("$VERCEL_BIN" deploy --prebuilt --prod --token="$VERCEL_AUTH_TOKEN")"

log "Deployment complete"
printf '%s\n' "$DEPLOYMENT_URL"

if [[ -n "${PRODUCTION_ALIAS_DOMAIN:-}" ]]; then
  log "Setting Vercel alias"
  "$VERCEL_BIN" alias set "$DEPLOYMENT_URL" "$PRODUCTION_ALIAS_DOMAIN" --token="$VERCEL_AUTH_TOKEN"
fi

if [[ -n "${PRODUCTION_HEALTH_URL:-}" ]]; then
  log "Health check"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSI "$PRODUCTION_HEALTH_URL"
  else
    log "curl not found; skipped health check for $PRODUCTION_HEALTH_URL"
  fi
fi

log "Done"

# package.json:
# "deploy:vercel:replit": "bash scripts/replit-vercel-prod-deploy.sh"