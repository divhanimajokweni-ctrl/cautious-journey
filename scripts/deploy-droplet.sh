#!/usr/bin/env bash
# scripts/deploy-droplet.sh
# ──────────────────────────────────────────────────────────────────
# Deploy ProofBridge Liner to the AMD MI300X DigitalOcean droplet.
#
# Target  : 165.245.140.197
# Droplet : FX-AM7-gpu-mi300x1-192gb-devcloud-atl1
# GPU     : AMD Instinct MI300X — 192 GB HBM3
# Image   : OpenAI GPT OSS (ROCm 7) on Ubuntu 24.04
# User    : root  (DigitalOcean marketplace default)
#
# Usage:
#   chmod +x scripts/deploy-droplet.sh
#   ./scripts/deploy-droplet.sh [flags]
#
# Flags:
#   --setup         First-time: apt update/upgrade + reboot (required by DO
#                   security notice). Waits for reboot then continues deploy.
#   --rocm          Mount host ROCm 7 into container for GPU acceleration
#   --restart-only  Skip build; just restart the running service
#   --dry-run       Print every SSH command without executing
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
DROPLET_IP="165.245.140.197"
DROPLET_USER="root"
REPO_DIR="/root/proofbridge-liner"
GITHUB_REPO="https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git"
SERVICE_NAME="proofbridge"
CONTAINER_NAME="proofbridge-liner"
PORT=7860

# ── Flags ─────────────────────────────────────────────────────────
DO_SETUP=false
USE_ROCM=false
RESTART_ONLY=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --setup)        DO_SETUP=true ;;
    --rocm)         USE_ROCM=true ;;
    --restart-only) RESTART_ONLY=true ;;
    --dry-run)      DRY_RUN=true ;;
    *) echo "Unknown flag: $arg  (valid: --setup --rocm --restart-only --dry-run)"; exit 1 ;;
  esac
done

DOCKERFILE="Dockerfile"
IMAGE_TAG="proofbridge-liner:latest"
if $USE_ROCM; then
  DOCKERFILE="Dockerfile.rocm"
  IMAGE_TAG="proofbridge-liner:rocm"
fi

# ── Helpers ───────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✔\033[0m  %s\n' "$*"; }
info()  { printf '  \033[34m·\033[0m  %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m  %s\n' "$*"; }
die()   { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=30"
SSH="ssh $SSH_OPTS ${DROPLET_USER}@${DROPLET_IP}"

ssh_run() {
  local label="$1"; shift
  info "$label"
  if $DRY_RUN; then
    printf '    \033[2m[dry-run] ssh %s@%s << HEREDOC\n' "$DROPLET_USER" "$DROPLET_IP"
    printf '    %s\033[0m\n' "$*"
  else
    $SSH "$@"
  fi
}

wait_for_ssh() {
  info "Waiting for droplet to come back online after reboot..."
  local attempts=0
  until $SSH "echo ok" &>/dev/null || [ $attempts -ge 30 ]; do
    sleep 5
    attempts=$((attempts+1))
    printf '.'
  done
  echo ""
  [ $attempts -lt 30 ] && ok "Droplet is back online" || die "Timed out waiting for reboot"
}

# ── Banner ────────────────────────────────────────────────────────
echo ""
bold "╔══════════════════════════════════════════════════════════╗"
bold "║  ProofBridge Liner — MI300X Droplet Deploy               ║"
bold "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Target  : ${DROPLET_USER}@${DROPLET_IP}:${PORT}"
info "GPU     : AMD Instinct MI300X — 192 GB HBM3"
info "Image   : ${IMAGE_TAG}  (${DOCKERFILE})"
info "Mode    : $(if $DRY_RUN; then echo DRY-RUN; elif $RESTART_ONLY; then echo RESTART-ONLY; elif $DO_SETUP; then echo SETUP+DEPLOY; else echo FULL-DEPLOY; fi)"
echo ""

# ── SSH connectivity check ────────────────────────────────────────
if ! $DRY_RUN; then
  info "Testing SSH connectivity to ${DROPLET_IP}..."
  if ! $SSH "echo ok" &>/dev/null; then
    die "Cannot SSH to ${DROPLET_IP}. Check your key is loaded (ssh-add) and the droplet is active."
  fi
  ok "SSH connection established"
fi

# ── SETUP: apt update/upgrade + reboot (run once after provisioning) ──
if $DO_SETUP; then
  bold ""
  bold "  ── Phase 0: System update (required by DigitalOcean security notice)"
  echo ""

  ssh_run "Updating system packages (this takes a few minutes)..." bash << 'ENDSSH'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
    apt-get autoremove -y
    echo "  System updated."
ENDSSH
  ok "System packages updated"

  ssh_run "Rebooting droplet..." bash << 'ENDSSH'
    nohup bash -c 'sleep 2 && reboot' &>/dev/null &
ENDSSH
  ok "Reboot initiated"

  if ! $DRY_RUN; then
    sleep 8
    wait_for_ssh
  fi
fi

# ── Clone or pull repo ────────────────────────────────────────────
if ! $RESTART_ONLY; then
  bold ""
  bold "  ── Phase 1: Sync repository"
  echo ""

  ssh_run "Cloning / pulling repo on droplet" bash << ENDSSH
    set -e
    if [ -d "${REPO_DIR}/.git" ]; then
      echo "  Pulling latest..."
      cd "${REPO_DIR}" && git pull --ff-only
    else
      echo "  Cloning from GitHub..."
      git clone "${GITHUB_REPO}" "${REPO_DIR}"
    fi
    cd "${REPO_DIR}"
    echo "  HEAD: \$(git log --oneline -1)"
ENDSSH
  ok "Repo synced at ${REPO_DIR}"

  # ── Ensure Docker is installed ──────────────────────────────────
  ssh_run "Checking Docker installation" bash << 'ENDSSH'
    set -e
    if ! command -v docker &>/dev/null; then
      echo "  Docker not found — installing..."
      curl -fsSL https://get.docker.com | sh
    else
      echo "  Docker $(docker --version | cut -d' ' -f3) already installed"
    fi
ENDSSH
  ok "Docker ready"

  # ── Build Docker image ──────────────────────────────────────────
  bold ""
  bold "  ── Phase 2: Build Docker image"
  echo ""

  ssh_run "Building ${IMAGE_TAG} from ${DOCKERFILE}" bash << ENDSSH
    set -e
    cd "${REPO_DIR}"
    echo "  Building ${IMAGE_TAG}..."
    docker build -f ${DOCKERFILE} -t ${IMAGE_TAG} .
    echo "  Image size: \$(docker image inspect ${IMAGE_TAG} --format '{{.Size}}' | numfmt --to=iec 2>/dev/null || echo 'N/A')"
ENDSSH
  ok "Docker image built: ${IMAGE_TAG}"

  # ── Install systemd service ─────────────────────────────────────
  bold ""
  bold "  ── Phase 3: Install systemd service"
  echo ""

  # ROCm device flags (host ROCm mounted at /opt/rocm)
  ROCM_FLAGS=""
  if $USE_ROCM; then
    ROCM_FLAGS="  --device /dev/kfd \\\\\n  --device /dev/dri \\\\\n  --group-add video \\\\\n  --group-add render \\\\\n  -v /opt/rocm:/opt/rocm:ro \\\\\n  -e ROCM_PATH=/opt/rocm \\\\\n  -e LD_LIBRARY_PATH=/opt/rocm/lib:\$LD_LIBRARY_PATH \\\\"
  fi

  ssh_run "Writing /etc/systemd/system/${SERVICE_NAME}.service" bash << ENDSSH
    set -e
    cat > /etc/systemd/system/${SERVICE_NAME}.service << 'EOF'
[Unit]
Description=ProofBridge Liner — AMD MI300X Safety Kernel
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=10
EnvironmentFile=-/root/proofbridge-liner/.env.deployed

ExecStartPre=-/usr/bin/docker rm -f ${CONTAINER_NAME}
ExecStart=/usr/bin/docker run --rm \\
  --name ${CONTAINER_NAME} \\
  --network host \\
  $(if $USE_ROCM; then printf '%b' "${ROCM_FLAGS}"; fi)
  -e NODE_ENV=production \\
  -e DASHBOARD_PORT=${PORT} \\
  -e DASHBOARD_HOST=0.0.0.0 \\
  -e HF_TOKEN=\${HF_TOKEN:-} \\
  -e POLYGON_AMOY_RPC_URL=\${POLYGON_AMOY_RPC_URL:-} \\
  -e ORACLE_ADDRESS=\${ORACLE_ADDRESS:-} \\
  -e CIRCUIT_BREAKER_ADDRESS=\${CIRCUIT_BREAKER_ADDRESS:-} \\
  -e ASSET_REGISTRY_ADDRESS=\${ASSET_REGISTRY_ADDRESS:-} \\
  -e TEE_VERIFIER_ADDRESS=\${TEE_VERIFIER_ADDRESS:-} \\
  -e ENCLAVE_ADDRESS=\${ENCLAVE_ADDRESS:-} \\
  ${IMAGE_TAG}
ExecStop=/usr/bin/docker stop ${CONTAINER_NAME}
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    echo "  Service file written and enabled."
ENDSSH
  ok "systemd service installed"
fi

# ── Start / restart service ───────────────────────────────────────
bold ""
bold "  ── Phase 4: Start service"
echo ""

ssh_run "Starting ${SERVICE_NAME}" bash << ENDSSH
  set -e
  systemctl restart ${SERVICE_NAME}
  sleep 4
  systemctl is-active ${SERVICE_NAME} && echo "  Service is active" || echo "  WARNING: service not active"
ENDSSH
ok "Service started"

# ── Health check ─────────────────────────────────────────────────
if ! $DRY_RUN; then
  info "Waiting for health check on :${PORT}/health ..."
  sleep 6
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    "http://${DROPLET_IP}:${PORT}/health" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    PAYLOAD=$(curl -sf "http://${DROPLET_IP}:${PORT}/health" 2>/dev/null || echo "{}")
    ok "Health check passed — ${PAYLOAD}"
  else
    warn "Health returned HTTP ${HTTP_CODE} — check logs:"
    echo "       ssh root@${DROPLET_IP} 'journalctl -u ${SERVICE_NAME} -n 50 --no-pager'"
  fi
fi

# ── GPU status (ROCm only) ────────────────────────────────────────
if $USE_ROCM && ! $DRY_RUN; then
  echo ""
  info "AMD GPU status:"
  $SSH "rocm-smi --showproductname --showmeminfo vram 2>/dev/null || echo '  rocm-smi not in PATH on host — check inside container'" \
    | sed 's/^/    /'
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
bold "╔══════════════════════════════════════════════════════════╗"
bold "║  DEPLOY COMPLETE                                         ║"
bold "╚══════════════════════════════════════════════════════════╝"
echo ""
printf '  %-12s %s\n' "Dashboard"  "http://${DROPLET_IP}:${PORT}"
printf '  %-12s %s\n' "Health"     "http://${DROPLET_IP}:${PORT}/health"
printf '  %-12s %s\n' "API"        "http://${DROPLET_IP}:${PORT}/api/status"
echo ""
printf '  %-12s %s\n' "Logs"       "ssh root@${DROPLET_IP} 'journalctl -u ${SERVICE_NAME} -f'"
printf '  %-12s %s\n' "Shell"      "ssh root@${DROPLET_IP}"
if $USE_ROCM; then
  printf '  %-12s %s\n' "GPU info"   "ssh root@${DROPLET_IP} 'rocm-smi'"
  printf '  %-12s %s\n' "VRAM"       "192 GB HBM3 — AMD Instinct MI300X"
fi
echo ""
