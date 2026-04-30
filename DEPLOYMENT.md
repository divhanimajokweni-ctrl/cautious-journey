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
Create `.env` file:
```bash
# Polygon Amoy deployment
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=0xb25939caa5515f9ded22aedf08ce0ec6778ac2ef5e11cadef24bff24f017fed6

# Contract addresses (after deployment)
CIRCUIT_BREAKER_ADDRESS=0x...
MOCK_REAL_T_ADDRESS=0x...

# Oracle configuration
ORACLE_ADDRESS=0x49A1ba2Bde61B96685385F4Ce012586A518c3E70

# Dashboard
DASHBOARD_PORT=5000
DASHBOARD_HOST=0.0.0.0

# Fetcher configuration
FETCHER_POLL_MS=300000
```

## Contract Deployment

### CircuitBreaker Contract
1. Deploy to Polygon Amoy:
   ```bash
   npm run deploy:amoy
   ```

2. Verify deployment logs:
   ```
   CircuitBreaker deployed at: 0x770342c49e1F4710E0Eed605dCe41e7f3F7600Eb
   Oracle: 0x49A1ba2Bde61B96685385F4Ce012586A518c3E70
   ```

3. Update `.env` with contract address

### MockRealT Integration Demo
1. Deploy integration test contract:
   ```bash
   npm run deploy:amoy  # Uses DeployMockRealT.s.sol
   ```

2. Test transfer blocking:
   ```bash
   cast send <mock_address> "transfer(address,uint256)" <recipient> 1000000000000000000 --private-key $PRIVATE_KEY --rpc-url $POLYGON_AMOY_RPC_URL
   # Should revert: "MockRealT: ghost-risk detected"
   ```

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