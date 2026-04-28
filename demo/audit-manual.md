# ProofBridge Liner - Ghost-Risk Audit Automation Manual

## Overview

This manual describes the automated ghost-risk audit system for ProofBridge Liner, a circuit-breaker for tokenized real-world assets (RWAs). The system uses DeepSeek-V4-Pro on NVIDIA Blackwell GPUs via the NVIDIA NIM API to perform forensic analysis of property deeds stored on IPFS, detecting silent tampering or irregularities that could compromise RWA security.

The audit process integrates AI-powered document analysis into the existing off-chain prover pipeline, producing issuer-ready reports that highlight discrepancies in legal clauses, property descriptions, vesting terms, and encumbrances.

## Architecture

### Components

1. **Fetcher (`prover/fetcher.js`)**: Polls IPFS for deed PDFs, computes SHA-256 hashes, and compares against expected values. Outputs status (fresh/mismatch/unreachable) to `.local/state/prover-state.json`.

2. **Auditor (`prover/auditor.js`)**: Consumes prover state, fetches deed content, extracts text from PDFs, and submits forensic prompts to DeepSeek-V4-Pro. Generates narrative audit reports in `demo/audit-realT.md`.

3. **Submitter (`prover/submitter.js`)**: Plans on-chain actions based on audit results, creates SafeKrypte attestations, and prepares for circuit-breaker interactions.

### Data Flow

```
IPFS Deeds → Fetcher (hash check) → Auditor (AI analysis) → Report (demo/audit-realT.md)
                              ↓
                      Prover State (.local/state/prover-state.json)
                              ↓
                    Submitter (action planning) → Attestations
```

## Prerequisites

- Node.js >= 20
- npm dependencies installed (`npm install`)
- NVIDIA API key from [build.nvidia.com](https://build.nvidia.com)
- IPFS gateways accessible (default: ipfs.io, cloudflare-ipfs.com)
- Assets configured in `config/assets.json`

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Obtain NVIDIA API Key**:
   - Visit [https://build.nvidia.com](https://build.nvidia.com)
   - Sign up and generate an API key
   - Set environment variable:
     ```bash
     export NVIDIA_API_KEY="nvapi-your-key-here"
     ```

3. **Configure Assets**:
   - Edit `config/assets.json` to include asset IDs, IPFS CIDs, and expected hashes
   - Example:
     ```json
     [
       {
         "assetId": "0x...",
         "label": "Property #1",
         "ipfsCid": "bafy...",
         "expectedHash": "0x...",
         "gateways": ["https://ipfs.io/ipfs/"]
       }
     ]
     ```

## Running the Audit

### Step 1: Fetch Deed Status

Run the fetcher to check current deed integrity:

```bash
npm run fetch
```

This updates `.local/state/prover-state.json` with hash comparison results.

For continuous monitoring:

```bash
npm run fetch:watch
```

### Step 2: Generate Audit Report

Run the auditor to perform AI analysis:

```bash
npm run audit
```

**Requirements**:
- `NVIDIA_API_KEY` environment variable set
- Prover state exists (run fetcher first)

**Output**: `demo/audit-realT.md` - A comprehensive forensic report for each asset.

### Step 3: Plan On-Chain Actions (Optional)

Run the submitter to prepare circuit-breaker actions:

```bash
npm run submit:dry
```

This generates attestations in `.local/state/submitter-attestations.json` without broadcasting.

## Report Format

The audit report (`demo/audit-realT.md`) follows this structure:

```
# ProofBridge Liner - Ghost-Risk Audit Report

Generated: 2026-04-27T22:45:33.000Z

## Asset ID: 0x52aa9c8c3e83a0f1f4f73b1f4d0f2c4a4b3a2d1c0e9d8c7b6a5948372615040f

**Status:** mismatch
**Expected Hash:** 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
**Actual Hash:** 0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed
**IPFS CID:** bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354

[AI-Generated Analysis Paragraph 1]

[AI-Generated Analysis Paragraph 2]

## Asset ID: 0x9f3e2a1b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f

**Status:** fresh
**Expected Hash:** 0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed
**Actual Hash:** 0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed
**IPFS CID:** bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354

[AI-Generated Analysis Paragraph 1]

[AI-Generated Analysis Paragraph 2]
```

### Analysis Content

Each asset section includes:
- **Status Indicators**: Fresh (no issues), Mismatch (hash discrepancy), Unreachable (fetch failure)
- **Cryptographic Anchors**: Expected vs. actual SHA-256 hashes for tamper detection
- **AI Forensic Summary**: Two-paragraph analysis focusing on:
  - Legal clause discrepancies (property description, vesting, encumbrances)
  - Title validity and security implications for RWA tokenization
  - Recommendations for issuers (e.g., legal review, circuit-breaker activation)

## AI Prompt Engineering

The auditor uses this forensic prompt template:

```
You are a forensic auditor. Analyze this property deed document text and compare it to the expected cryptographic hash: {expectedHash}.

The current status is: {status} (fresh means hash matches, mismatch means potential tampering).

Highlight any discrepant clauses, legal issues, or irregularities that could affect tokenization or RWA security. Focus on property description, vesting, encumbrances, and title validity.

Produce a two-paragraph summary suitable for an issuer’s legal team, including recommendations if issues are found.
```

- **Model**: deepseek-ai/deepseek-v4-pro
- **Parameters**: max_tokens=2000, temperature=0.1
- **API**: NVIDIA NIM OpenAI-compatible endpoint

## Error Handling

### Fetcher Errors
- Gateway failures: Retries across multiple IPFS gateways
- Unreachable deeds: Marked as "unreachable" in state

### Auditor Errors
- API key missing: Throws error with clear message
- PDF parsing failures: Logged, asset skipped
- API failures: Retries up to 3 times with exponential backoff
- Cache misses: Falls back to fresh fetch

### Common Issues
- **No API Key**: Set `export NVIDIA_API_KEY=...`
- **Rate Limits**: Built-in retries handle transient issues
- **Large PDFs**: Model handles up to 1M token context
- **Network Issues**: Multiple gateways ensure reliability

## Performance Considerations

- **Caching**: Deed text cached in `.local/state/cache/` by CID
- **Parallel Processing**: Assets analyzed sequentially (could be batched)
- **API Costs**: Free tier on NVIDIA Build Platform
- **Execution Time**: ~30s per asset (fetch + analysis)

## Security

- API keys stored in environment variables
- No secrets logged or committed
- Cryptographic hash verification before AI analysis
- SafeKrypte integration for action attestations

## Extensions

### Threat Model Integration
Future versions can extend analysis to correlational failure modes:
- Simultaneous lawyer/gateway failures
- Voided titles post-tokenization

### ML Pipeline Enhancement
Add classification layer for "cosmetic" vs. "material" changes, reducing false positives.

### Issuer Outreach
Use AI to draft personalized cold emails based on report findings.

## Troubleshooting

### Auditor Fails
```bash
# Check API key
echo $NVIDIA_API_KEY

# Run fetcher first
npm run fetch

# Check logs
npm run audit 2>&1 | tee audit.log
```

### Empty Report
- Verify `prover-state.json` exists and has results
- Check IPFS CID validity
- Ensure PDF contains extractable text

### API Errors
- Confirm key validity on build.nvidia.com
- Check network connectivity to integrate.api.nvidia.com

## Full-Scale Report Generation

To generate a full-scale report with AI analysis:

1. **Set NVIDIA API Key**:
   ```bash
   export NVIDIA_API_KEY="nvapi-your-key-here"  # Get from https://build.nvidia.com
   ```

2. **Run Complete Audit**:
   ```bash
   npm run fetch  # Update prover state
   npm run audit  # Generate AI-powered report
   ```

3. **Review Enhanced Report**:
   - AI analysis will provide forensic summaries for each asset
   - Focus on discrepancies in property deeds
   - Use for issuer outreach and security validation

## Next Tasks Required

### Immediate (Phase 02 Completion)
1. **Obtain NVIDIA API Key**: Free access to DeepSeek-V4-Pro for AI auditing.
2. **Test AI Analysis**: Run `npm run audit` with API key to generate forensic reports.
3. **Validate PDF Extraction**: Upgrade auditor.js to use pdf-parse for reliable text extraction from deeds.
4. **Generate Issuer Pitches**: Use AI to draft cold outreach emails based on audit findings.

### Short-Term (Phase 03 - Circuit Breaker Wiring)
1. **Fund Deployment Wallet**: Send MATIC to `0x49A1ba2Bde61B96685385F4Ce012586A518c3E70` on Polygon Amoy.
2. **Deploy CircuitBreaker Contract**: Run `npm run deploy:amoy` after funding.
3. **Wire Broadcaster**: Integrate submitter.js with deployed contract address.
4. **Test On-Chain Actions**: Run `npm run broadcast:dry` then live broadcast.

### Medium-Term (Phase 04 - Threat Model Extension)
1. **Enhance Auditor**: Add ML classification for cosmetic vs. material changes.
2. **Correlational Analysis**: Extend AI prompts for multi-asset failure modes.
3. **Security Review**: Audit SafeKrypte integration and attestation signing.
4. **Performance Optimization**: Batch API calls and add parallel processing.

### Long-Term (Production Scaling)
1. **Multi-Asset Support**: Expand assets.json for full RealT portfolio.
2. **Monitoring Dashboard**: Build dashboard/server.js for real-time status.
3. **Backup Gateways**: Add more IPFS gateways and failover logic.
4. **Compliance Documentation**: Generate audit trails for regulatory approval.

## Current Status
- ✅ Off-chain prover pipeline operational
- ✅ Basic audit report generation
- ⚠️ AI analysis blocked by missing API key
- ⚠️ PDF text extraction needs improvement
- ❌ On-chain broadcasting not wired (requires funded wallet)

Next critical blocker: Obtain NVIDIA API key and re-run audit for full AI-powered reports.