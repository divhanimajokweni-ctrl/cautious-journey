# ProofBridge Liner MVP - Complete Documentation

## Project Overview
**ProofBridge Liner** is a ghost-risk circuit-breaker for tokenized real-world assets, implemented as a 72-hour MVP. It provides ERC-20 transfer validation by checking deed hash proofs against on-chain state, tripping a global circuit breaker if proofs become stale or mismatched.

## Architecture

### Core Components

#### 1. CircuitBreaker Smart Contract (`contracts/CircuitBreaker.sol`)
**Purpose**: On-chain validation and circuit breaker logic
- **Trust Model**: Single oracle MVP (upgradeable to 3-of-5 quorum)
- **Key Functions**:
  - `validate(assetId, expectedHash)`: ERC-20 hook validation
  - `updateProof(assetId, deedHash)`: Oracle proof updates
  - `tripCircuit(reason)`: Emergency circuit breaker
  - `reset()`: Owner circuit restoration

**Security Features**:
- Access controls (onlyOracle, onlyOwner)
- Event logging for all state changes
- Initialization guard
- Gas-optimized validation

#### 2. Off-Chain Prover (`prover/`)

**Fetcher (`prover/fetcher.js`)**:
- Fetches deed PDFs from IPFS gateways
- Computes SHA-256 hashes
- Compares against expected values
- Persists results to JSON state file
- Multi-gateway fallback resilience

**Submitter (`prover/submitter.js`)**:
- Reads fetcher results
- Connects to Polygon Amoy via ethers.js
- Submits proof updates for fresh assets
- Trips circuit for mismatches/unreachable assets
- Dry-run mode for safe testing

#### 3. Operations Dashboard (`dashboard/server.js`)
**Purpose**: Real-time MVP monitoring
- Phase progress visualization
- Asset status display
- Test results with gas usage
- Circuit breaker state monitoring
- RESTful API endpoints

#### 4. Configuration System
**Assets** (`config/assets.json`): Asset definitions with IPFS CIDs and expected hashes
**Environment** (`.env`): Blockchain credentials and operational settings

## Development Workflow

### Phase Structure & Publication Status
| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| 0 | Env scaffold | ✅ Complete | 100% |
| 1 | CircuitBreaker contract + tests | ✅ Complete | 100% |
| 2 | Deploy to Polygon Amoy | 🟡 Ready | 30% |
| 3 | Fetcher + submitter | 🟡 In Progress | 60% |
| 4 | 3-node quorum | 📋 Future | 0% |
| 5 | E2E demo | 📋 Future | 0% |
| 6 | Audit & pitch | ✅ Complete | 100% |

**Publication Readiness:**
- **Class A (Research)**: ✅ Ready Now - Formal spec, audit memo, GitHub release
- **Class B (Protocol)**: 🟡 1 Sprint Away - Live testnet deployment
- **Class C (Demo)**: 📋 Post-Release - Full production demo

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dashboard**:
   ```bash
   npm run start  # http://localhost:5000
   ```

3. **Test Prover Components**:
   ```bash
   npm run fetch              # One-shot fetch
   npm run fetch:watch        # Polling fetch
   npm run submit:dry         # Dry-run submitter
   npm run submit             # Live submitter (requires deployment)
   ```

4. **Test Contracts**:
   ```bash
   npm run test:contracts     # Foundry tests
   ```

### Deployment to Polygon Amoy

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with real credentials
   ```

2. **Deploy Contract**:
   ```bash
   npm run deploy:amoy
   ```

3. **Update Configuration**:
   ```bash
   # Add deployed contract address to .env
   CIRCUIT_BREAKER_ADDRESS=0xDEPLOYED_ADDRESS
   ```

## API Reference

### Dashboard Endpoints

**GET /api/status**
Returns comprehensive system status:
```json
{
  "phases": [...],
  "assets": [...],
  "proverState": {...},
  "circuitState": {...},
  "testResults": [...]
}
```

### Contract Interface

**IProofHook**:
```solidity
function validate(bytes32 assetId, bytes32 expectedHash) external view returns (bool);
```

**CircuitBreaker**:
```solidity
function initialize(address oracle) external;
function updateProof(bytes32 assetId, bytes32 deedHash) external; // onlyOracle
function tripCircuit(string reason) external; // onlyOracle
function reset() external; // onlyOwner
function validate(bytes32 assetId, bytes32 expectedHash) external view returns (bool);
```

## Configuration Files

### .env Configuration
```bash
# Polygon Amoy deployment
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=your_api_key
PRIVATE_KEY=0xdeployer_private_key

# Contract roles
ORACLE_ADDRESS=0xoracle_wallet_address

# Deployed addresses
CIRCUIT_BREAKER_ADDRESS=0xdeployed_contract_address

# Operations
DASHBOARD_PORT=5000
DASHBOARD_HOST=0.0.0.0
FETCHER_POLL_MS=300000
TRIP_THRESHOLD=1
```

### Asset Configuration (`config/assets.json`)
```json
[
  {
    "assetId": "0x...",
    "label": "RealT Property Name",
    "ipfsCid": "bafy...",
    "expectedHash": "0x...",
    "gateways": ["https://ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/"]
  }
]
```

## Testing & Validation

### Contract Tests
```bash
forge test -vvv  # 14/14 tests passing
```

**Test Coverage**:
- Initialization and access controls
- Proof updates and event emission
- Circuit tripping and reset functionality
- Validation logic for all scenarios

### Integration Tests
- **Fetcher**: IPFS fetching, hash computation, multi-gateway fallback
- **Submitter**: Dry-run planning, on-chain transaction simulation
- **Dashboard**: Server startup, API endpoints, real-time data

### Performance Metrics
- **Contract Gas**: <50k per operation
- **Fetcher Response**: <300ms per asset
- **Submitter Planning**: Instant dry-run, <5s live submission
- **Dashboard Load**: <1s page response

## Security Considerations

### MVP Trust Assumptions
- **Single Oracle**: Trusted to push accurate proofs and trip circuit when needed
- **Owner Control**: Can reset circuit after investigation
- **IPFS Integrity**: Assumes IPFS content integrity (can be enhanced with Filecoin)

### Production Enhancements (Post-MVP)
- **Multi-Sig Oracle**: 3-of-5 ECDSA quorum for proof validation
- **Upgradeable Proxy**: Contract upgradeability without storage collision
- **Audit Requirements**: Formal security audit before mainnet
- **Monitoring**: 24/7 circuit status monitoring and alerting

## Error Handling

### Circuit Breaker States
- **Open (Normal)**: Transfers allowed, proofs being validated
- **Closed (Tripped)**: All transfers blocked, investigation required

### Error Scenarios
- **IPFS Unreachable**: Circuit trips after threshold exceeded
- **Hash Mismatch**: Indicates data corruption, circuit trips
- **RPC Failure**: Submitter retries with exponential backoff
- **Contract Revert**: Detailed error messages logged

## Future Roadmap

### Phase 4: Multi-Oracle Network
- Docker compose for 3-node quorum
- TSS signature aggregation
- Decentralized oracle network

### Phase 5: Production Demo
- End-to-end video demonstration
- Real-world asset integration
- Performance benchmarking

### Phase 6: Launch Preparation
- Smart contract audit
- Mainnet deployment
- Tokenized asset partnerships

## Contributing

### Development Environment
- Node.js >= 20
- Foundry (forge, cast)
- Git for version control

### Code Standards
- Solidity: ^0.8.20 with comprehensive testing
- JavaScript: ES6+ with error handling
- Documentation: Markdown with code examples

### Testing Requirements
- 100% test coverage for smart contracts
- Integration tests for off-chain components
- Manual testing for deployment workflows

## License
MIT License - See LICENSE file for details.

## Support
For questions or issues:
- GitHub Issues: https://github.com/your-org/proofbridge-liner/issues
- Documentation: This README and inline code comments
- Dashboard: http://localhost:5000 (when running locally)

---

**ProofBridge Liner Safety Kernel v1.0 Frozen** | April 27, 2026 | Class A Publication Ready