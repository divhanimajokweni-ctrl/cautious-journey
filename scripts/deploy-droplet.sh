#!/usr/bin/env bash
# scripts/deploy-droplet.sh
# ──────────────────────────────────────────────────────────────────
# Deploy ProofBridge Liner to the AMD ROCm 7 DigitalOcean droplet.
#
# Target: 165.245.140.197  (DigitalOcean — OpenAI GPT OSS ROCm 7)
# User:   proofbridge
#
# Usage:
#   chmod +x scripts/deploy-droplet.sh
#   ./scripts/deploy-droplet.sh [--rocm] [--restart-only] [--dry-run]
#
# Flags:
#   --rocm          Build with Dockerfile.rocm (AMD GPU acceleration)
#   --restart-only  Skip build; just restart the systemd service
#   --dry-run       Print SSH commands without executing them
#
# Prerequisites:
#   - Your SSH private key registered on the droplet (cloud-init added it)
#   - Git remote set to the GitHub repo
#   - SENDGRID_API_KEY, HF_TOKEN etc. exported in your local shell
#     (they are forwarded to the droplet via SSH env vars)
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
DROPLET_IP="165.245.140.197"
DROPLET_USER="proofbridge"
REPO_DIR="/home/proofbridge/proofbridge-liner"
GITHUB_REPO="https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git"
SERVICE_NAME="proofbridge"
CONTAINER_NAME="proofbridge-liner"
PORT=7860

# ── Flags ─────────────────────────────────────────────────────────
USE_ROCM=false
RESTART_ONLY=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --rocm)         USE_ROCM=true ;;
    --restart-only) RESTART_ONLY=true ;;
    --dry-run)      DRY_RUN=true ;;
    *)              echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

DOCKERFILE="Dockerfile"
IMAGE_TAG="proofbridge-liner:latest"
if $USE_ROCM; then
  DOCKERFILE="Dockerfile.rocm"
  IMAGE_TAG="proofbridge-liner:rocm"
fi

# ── Helpers ───────────────────────────────────────────────────────
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m  %s\n' "$*"; }
info() { printf '  \033[34m·\033[0m  %s\n' "$*"; }
die()  { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
SSH="ssh $SSH_OPTS ${DROPLET_USER}@${DROPLET_IP}"

ssh_run() {
  local label="$1"; shift
  info "$label"
  if $DRY_RUN; then
    echo "    [dry-run] ssh ${DROPLET_USER}@${DROPLET_IP} '$*'"
  else
    $SSH "$@"
  fi
}

# ── Pre-flight ────────────────────────────────────────────────────
bold ""
bold "ProofBridge Liner — Droplet Deploy"
bold "  Target : ${DROPLET_USER}@${DROPLET_IP}:${PORT}"
bold "  Image  : ${IMAGE_TAG}  (${DOCKERFILE})"
bold "  Mode   : $(if $DRY_RUN; then echo DRY-RUN; elif $RESTART_ONLY; then echo RESTART-ONLY; else echo FULL-DEPLOY; fi)"
echo ""

if ! $DRY_RUN; then
  info "Testing SSH connectivity..."
  if ! $SSH "echo ok" &>/dev/null; then
    die "Cannot SSH to ${DROPLET_IP}. Check your key and that the droplet is running."
  fi
  ok "SSH connection OK"
fi

# ── Clone or pull ─────────────────────────────────────────────────
if ! $RESTART_ONLY; then
  ssh_run "Ensuring repo is up to date on droplet" bash -s << ENDSSH
    set -e
    if [ -d "${REPO_DIR}/.git" ]; then
      echo "  Pulling latest..."
      cd "${REPO_DIR}" && git pull --ff-only
    else
      echo "  Cloning repo..."
      git clone "${GITHUB_REPO}" "${REPO_DIR}"
    fi
ENDSSH
  ok "Repo synced"

  # ── Build Docker image ──────────────────────────────────────────
  ROCM_FLAG=""
  $USE_ROCM && ROCM_FLAG="true"

  ssh_run "Building Docker image (${IMAGE_TAG})" bash -s << ENDSSH
    set -e
    cd "${REPO_DIR}"
    DOCKERFILE="${DOCKERFILE}"
    IMAGE_TAG="${IMAGE_TAG}"
    echo "  Building with \${DOCKERFILE}..."
    docker build -f "\${DOCKERFILE}" -t "\${IMAGE_TAG}" .
    echo "  Build complete."
ENDSSH
  ok "Docker image built: ${IMAGE_TAG}"

  # ── Write / update systemd service ─────────────────────────────
  ROCM_DEVICES=""
  if $USE_ROCM; then
    ROCM_DEVICES="--device /dev/kfd \\\\
      --device /dev/dri \\\\
      --group-add video \\\\
      --group-add render \\\\"
  fi

  ssh_run "Installing systemd service" sudo bash -s << ENDSSH
    set -e
    cat > /etc/systemd/system/${SERVICE_NAME}.service << 'EOF'
[Unit]
Description=ProofBridge Liner — AMD Safety Kernel Dashboard
After=docker.service network.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker rm -f ${CONTAINER_NAME}
ExecStart=/usr/bin/docker run --rm \\
  --name ${CONTAINER_NAME} \\
  --network host \\
  ${ROCM_DEVICES}
  -e NODE_ENV=production \\
  -e DASHBOARD_PORT=${PORT} \\
  -e DASHBOARD_HOST=0.0.0.0 \\
  -e HF_TOKEN=\${HF_TOKEN:-} \\
  -e POLYGON_AMOY_RPC_URL=\${POLYGON_AMOY_RPC_URL:-} \\
  -e ORACLE_ADDRESS=\${ORACLE_ADDRESS:-} \\
  -e ASSET_REGISTRY_ADDRESS=\${ASSET_REGISTRY_ADDRESS:-} \\
  -e TEE_VERIFIER_ADDRESS=\${TEE_VERIFIER_ADDRESS:-} \\
  -e ENCLAVE_ADDRESS=\${ENCLAVE_ADDRESS:-} \\
  -e CIRCUIT_BREAKER_ADDRESS=\${CIRCUIT_BREAKER_ADDRESS:-} \\
  ${IMAGE_TAG}
ExecStop=/usr/bin/docker stop ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    echo "  Service installed."
ENDSSH
  ok "systemd service installed"
fi

# ── Restart service ───────────────────────────────────────────────
ssh_run "Restarting ${SERVICE_NAME} service" sudo bash -s << ENDSSH
  set -e
  systemctl restart ${SERVICE_NAME}
  echo "  Service restarted."
ENDSSH
ok "Service restarted"

# ── Health check ─────────────────────────────────────────────────
if ! $DRY_RUN; then
  info "Waiting for health check..."
  sleep 6
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    "http://${DROPLET_IP}:${PORT}/health" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    ok "Health check passed (HTTP ${HTTP_CODE})"
    PAYLOAD=$(curl -sf "http://${DROPLET_IP}:${PORT}/health" 2>/dev/null || echo "{}")
    echo "    Response: ${PAYLOAD}"
  else
    echo ""
    echo "  ⚠  Health check returned HTTP ${HTTP_CODE}"
    echo "     Dashboard may still be starting. Check:"
    echo "       ssh ${DROPLET_USER}@${DROPLET_IP} 'journalctl -u ${SERVICE_NAME} -f'"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
bold "──────────────────────────────────────────────────"
bold "  DEPLOY COMPLETE"
echo ""
echo "  Dashboard : http://${DROPLET_IP}:${PORT}"
echo "  Health    : http://${DROPLET_IP}:${PORT}/health"
echo "  API       : http://${DROPLET_IP}:${PORT}/api/status"
echo ""
echo "  Logs      : ssh ${DROPLET_USER}@${DROPLET_IP} 'journalctl -u ${SERVICE_NAME} -f'"
echo "  Shell     : ssh ${DROPLET_USER}@${DROPLET_IP}"
$USE_ROCM && echo "  GPU info  : ssh ${DROPLET_USER}@${DROPLET_IP} 'docker exec ${CONTAINER_NAME} rocm-smi'"
bold "──────────────────────────────────────────────────"
echo ""
