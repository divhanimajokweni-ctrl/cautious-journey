#!/bin/bash
# Bayesian Sentinel — In-Droplet One-Shot Deployment
# PASTE THIS ENTIRE SCRIPT INTO THE DROPLET WEB CONSOLE (as root)
# No interaction required — runs end-to-end

set -e

echo "═══════════════════════════════════════════════════════"
echo "  BAYESIAN SENTINEL — IN-DROPLET DEPLOYMENT"
echo "═══════════════════════════════════════════════════════"

# 1. Navigate to app directory
cd /root/proofbridge-liner || {
    echo "ERROR: /root/proofbridge-liner not found. Clone the repo first."
    exit 1
}

# 2. Pull latest code
echo "[1/5] Syncing repository..."
git pull origin main || {
    echo "ERROR: Git pull failed"
    exit 1
}
echo "✓ Repository updated"

# 3. Write .env.deployed
echo "[2/5] Deploying environment..."
cat > .env.deployed << 'ENVEOF'
# ProofBridge Liner — deployed addresses
# Network: Polygon Amoy (chainId 80002)

CIRCUIT_BREAKER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ASSET_REGISTRY_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
TEE_VERIFIER_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
ORACLE_ADDRESS=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
ENCLAVE_ADDRESS=0x70997970c51812dc3a010c7d01b50e0d17dc79c8
ENVEOF
echo "✓ .env.deployed written"

# 4. Restart service
echo "[3/5] Restarting proofbridge..."
systemctl daemon-reload
systemctl restart proofbridge
sleep 3
systemctl is-active --quiet proofbridge || {
    echo "ERROR: Service failed to start"
    systemctl status proofbridge --no-pager -l
    exit 1
}
echo "✓ Service active"

# 5. Health check
echo "[4/5] Verifying health endpoint..."
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:7860/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Health check PASSED (HTTP 200)"
    curl -s http://localhost:7860/health
else
    echo "⚠ Health check returned HTTP $HTTP_CODE (may still be starting)"
fi

# 6. Final status
echo "[5/5] Service status:"
systemctl status proofbridge --no-pager

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "  Dashboard: http://localhost:7860"
echo "  API:       http://localhost:7860/api/status"
echo "═══════════════════════════════════════════════════════"
