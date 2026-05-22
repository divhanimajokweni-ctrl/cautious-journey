# Deployment Guide

## Prerequisites

### Environment Setup
1. Install Node.js >= 20.0
2. Install Foundry (latest version)
3. Clone repository and install dependencies:
   ```bash
   git clone https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
   cd proofbridge-liner
   npm install
   ```

### Wallet Funding
- Deployer address: `0x49A1ba2Bde61B96685385F4Ce012586A518c3E70`
- Required balance: ~0.06 POL for contracts + gas
- Faucet: https://faucet.polygon.technology/ (Amoy testnet)

### Environment Variables

Create `.env` file with a **new keypair on a fresh funded wallet**:

```bash
# ⛔ BLOCKED KEYS — rotated out of git history on 2026-05-22.
#    DO NOT use the key ending in `...f017fed6` or `...f02` anywhere.
#    Abort deployment immediately if either appears in PRIVATE_KEY or ORACLE_PRIVATE_KEY.
#    Generate a new keypair for all live deploys.
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000

# Contract addresses (after deployment)
CIRCUIT_BREAKER_ADDRESS=0x0DA76b3179d1bce8045c832BB6D8fe9C226BfE57
MOCK_REAL_T_ADDRESS=0xb91C1aC1Bbc9D7df85A858BCb7705D7edd8fEc82

# Oracle configuration
ORACLE_ADDRESS=0x49A1ba2Bde61B96685385F4Ce012586A518c3E70

# Contract verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Dashboard
DASHBOARD_PORT=5000
DASHBOARD_HOST=0.0.0.0

# Fetcher configuration
FETCHER_POLL_MS=300000
```

## Branching, Push, and Deploy

### Quick deploy (recommended for production)

```bash
export NETWORK=amoy
export DEPLOYER_PRIVATE_KEY=0x<new-rotated-key>
export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
export POLYGONSCAN_API_KEY=<your-key>
bash deploy/full_auto_deploy.sh
```

The full auto pipeline handles: forge build → broadcast both contracts → extract addresses → verify on Etherscan → save rollback snapshot → sync all env vars to Vercel via API → `npx vercel deploy --prod` → git-tag audit trail → Slack/Telegram alert.

### Manual deploy (contracts only)

```bash
forge script script/DeployUbuntuPoolsEngine.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

forge script script/DeployRiskOracleVerifier.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

Copy contract addresses from console output into Vercel Dashboard → Environment Variables → Production:
`POOLS_ENGINE_ADDRESS`, `ORACLE_PUBLIC_KEY`, `CONTRACT_ADDRESS`.

### Push API to Vercel

```bash
git push origin gate-1
npx vercel --confirm --prod
```

### Pre-push checklist (also in `AGENTS.md §7`)

```
[ ] Branch is correct (gate-1 / main only)
[ ] No uncommitted secrets or PII in diff
[ ] api/auth/*.js syntax passes: node --check
[ ] DEPLOYER_PRIVATE_KEY not in working tree or git diff (grep 0xb259)
[ ] vvv/vercel.json vs root/vercel.json diff reviewed
[ ] vercel.json has no shadowing /api/(.*) catch-all
[ ] vercel ls → exactly 1 Production alias
[ ] All production Vercel env vars confirmed set
```

### Rolling back failed deploys

`deploy/rollback.sh` reads the most recent snapshot from `deploy/snapshots/` and restores all `LIVE_` env vars back to Vercel. Always run `deploy/rollback.sh` before a second `--prod` if the first deploy was bad.

## Prover Pipeline Setup

### TSS Quorum (Optional for Live Broadcasting)
```bash
docker-compose -f signer-nodes/docker-compose.quorum.yml up -d
```

### Asset Configuration
Create `config/assets.json`:
```json
[
  {
    "assetId": "0x52aa9c8c3e83a0f1f4f73b1f4d0f2c4a4b3a2d1c0e9d8c7b6a5948372615040f",
    "label": "RealT Detroit Property #1",
    "ipfsCid": "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
    "expectedHash": "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "gateways": ["https://ipfs.io/ipfs/", "https://dweb.link/ipfs/"]
  }
]
```

### Scoring Configuration
Create `config/scoring.json` (South Africa jurisdiction):
```json
{
  "jurisdiction": "South Africa",
  "deterministicFloor": 0.8,
  "thresholdA": 0.285,
  "thresholdB": 0.45,
  "minMismatchesB": 2,
  "deterministicOverride": true
}
```

**TEE Setup**: Ensure TEE attestation service is configured for Act 47 of 1937 compliance validation.

## Verification Steps

### On-Chain State
```bash
# Check circuit status
cast call $CIRCUIT_BREAKER_ADDRESS "circuitOpen()" --rpc-url $POLYGON_AMOY_RPC_URL

# Check oracle address
cast call $CIRCUIT_BREAKER_ADDRESS "oracle()" --rpc-url $POLYGON_AMOY_RPC_URL
```

### Pipeline Testing
```bash
# Single run
npm run fetch

# Dry-run full pipeline
npm run submit:dry
npm run broadcast:dry

# Live operations (requires TSS)
npm run broadcast
```

### Dashboard
```bash
npm start  # Access at http://localhost:5000
```

## Troubleshooting

### Common Issues

#### Foundry Not Found
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

#### Insufficient Funds
- Check balance: `cast balance $DEPLOYER_ADDRESS --rpc-url $POLYGON_AMOY_RPC_URL`
- Fund via faucet if needed

#### TSS Connection Failed
- Start quorum: `docker-compose -f signer-nodes/docker-compose.quorum.yml up -d`
- Check ports 7001-7005 are accessible

#### RPC Rate Limits
- Switch to Alchemy or Infura RPC endpoint
- Implement exponential backoff in applications

### Health Checks

#### Contract Health
- All functions return expected values
- Circuit properly opens/closes
- Oracle operations work with threshold signatures

#### Pipeline Health
- Fetcher resolves assets without errors
- Scorer computes probabilities correctly
- Submitter generates valid attestations
- Broadcaster submits transactions successfully

## Production Deployment

### Mainnet Preparation
1. Update RPC to Polygon mainnet
2. Deploy contracts with verified source code
3. Set up production TSS quorum
4. Configure monitoring and alerting
5. Perform comprehensive security audit

### Scaling Considerations
- Monitor gas costs for large asset portfolios
- Implement batch processing for efficiency
- Set up multi-region gateway access
- Configure automated recovery procedures

### Backup and Recovery
- Regular state snapshots
- Multi-signature admin controls
- Emergency circuit trip procedures
- Off-chain data backup strategies