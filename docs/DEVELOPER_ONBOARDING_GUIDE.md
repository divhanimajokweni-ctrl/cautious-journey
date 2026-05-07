# ProofBridge Liner — Developer Onboarding Guide
**Safety Kernel v1.1.1 | 14-Day Sandbox Integration**

> Goal: Integrate the Safety Kernel into the Bank's Credit Switchboard sandbox.
> No prior blockchain experience required.

---

## ⚡ 60-Second QuickStart

```bash
git clone https://github.com/divhanimajokweni-ctrl/proofbridge-liner
cd proofbridge-liner
npm install
cp .env.example .env          # populate API keys — see credentials checklist below
./setup.sh                    # TEE init + PCR0 hash verification
npm start                     # monitoring dashboard → http://localhost:5000
npm run audit                 # first ghost-risk audit run
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 20.0 | Required |
| Foundry | latest | For contract interaction only |
| Docker | >= 24 | For TSS quorum (optional in sandbox) |
| TEE | AWS Nitro or Azure Confidential | PCR0 hash must be recorded before first run |

---

## Phase 1 — Environment & Auth (Days 1–3)

### Day 1: Register Credentials

**Standard Bank OneHub** (`developer.standardbank.co.za`)
- [ ] Create App ID → `Create New App` → record API Key + Client Secret
- [ ] Subscribe to `Property Deeds Office API` under CIB Marketplace
- [ ] Whitelist your TEE enclave's static IP in the API Sandbox settings

**Absa Access Developer Portal** (`developer.absa.africa`)
- [ ] Create application container → record Client ID + Client Secret
- [ ] Generate CSR → upload to portal for mTLS certificate issuance
- [ ] Request a "Sandbox User" for customer-authorized deed lookup tests

**LexisNexis WinDeed** (`windeed.co.za`)
- [ ] Confirm a Primary User exists in your org who can approve API access
- [ ] Submit WinCredit Registration Form for ID/ownership verification data
- [ ] Email `windeed.admin@lexisnexis.co.za` for sandbox REST API credentials

**Deeds Office (e-DRS / DeedsWeb)** (`deeds.gov.za`)
- [ ] Register on DeedsWeb portal for DRS credentials
- [ ] For financial institutions: obtain Certificate of Confirmation for bi-directional e-DRS access

### Day 2: Initialise TEE Enclave

```bash
./setup.sh
```

This script:
1. Initialises the TEE environment
2. Generates and seals the enclave private key (never leaves hardware boundary)
3. Records the PCR0 hash to `config/pcr0.lock`
4. Runs attestation verification

> ⚠️ Record the PCR0 hash. Any change to the proofbridge-liner image invalidates it.

### Day 3: Connectivity Check

```bash
npm run test:health
```

Verifies all gateway endpoints are reachable from the enclave:
- e-DRS portal
- WinDeed sandbox
- Standard Bank switchboard
- Absa Access sandbox

---

## Phase 2 — Data Bridge (Days 4–7)

### Days 4–5: Configure Adapters

Edit `adapters/deeds-registry.js`:

```javascript
// Point to your bank's internal Property Deeds API
const DEEDS_ENDPOINT = process.env.STANDARD_BANK_DEEDS_API_URL;
const WINDEED_FALLBACK = process.env.WINDEED_API_URL;
```

Edit `config/scoring.json` for production thresholds:

```json
{
  "jurisdiction": "South Africa",
  "deterministicOverride": true,
  "deterministicFloor": 0.8,
  "thresholdA": 0.60,
  "thresholdB": 0.355,
  "minMismatchesB": 2,
  "gamma": 20
}
```

### Day 6: Verify Latency

```bash
npm run test:load
```

Target: p95 < 50ms on the bank's internal switchboard.
If latency exceeds 50ms, check gateway routing and enclave network configuration.

### Day 7: Schema Validation

```bash
npm run test:schema
```

Runs Act 47 / 1937 deed structure checks against a sample of known-valid SA deed documents.
All 6 regex integrity checks must pass at 100% on valid documents.

---

## Phase 3 — Compliance & Reporting (Days 8–14)

### Days 8–9: Red Team Simulation

```bash
node scripts/simulate-red-team-attack.js
```

This simulates:
- **Mirror Attack**: 5 gateways all returning a forged deed (TEE clamp must fire)
- **Partial Collusion**: 3-of-5 gateways returning tampered data
- **Class B Structural Fraud**: identity theft / unauthorized bond cancellation pattern

Expected outputs:
- SOC Slack alert
- Email alert to configured CISO inbox
- `INVALID_SLASH` decision logged in `prover-state.json`
- Forensic bundle written to `docs/audit/`

### Days 10–11: goAML Export Test

```bash
node scripts/goaml-export.js --test
```

Validates that flagged Class B events generate compliant goAML XML SAR reports.
Check output against the FIC schema validator before submitting to compliance.

### Days 12–13: Audit Review

```bash
npm run audit:review
```

Confirms that all red-team logs in `docs/audit/` are:
- PII-sanitized (no raw identity data)
- Compliant with FSCA JS2 Section 12 requirements
- Timestamped and hash-chained

### Day 14: Steering Committee Readout

Present results to the bank's risk/CISO team. Provide:
- Pass/fail summary per compliance checkpoint
- Sample Forensic Evidence Bundle (sealed, anonymised)
- Latency and detection accuracy metrics
- Recommendation: proceed to live shadow pilot or extend sandbox

---

## Shadow Pilot Mode (Days 1–7)

During Phase 2, ProofBridge operates in **shadow mode**:
- Flags and logs all anomalies
- Does **not** block live transactions
- Generates alerts and reports as if in production

Blocking activates only in Phase 3 (Days 8–14) after joint review with the bank's risk team.

---

## Environment Variables Reference

```
# Standard Bank
STANDARD_BANK_DEEDS_API_URL=
STANDARD_BANK_API_KEY=
STANDARD_BANK_CLIENT_SECRET=

# Absa Access
ABSA_CLIENT_ID=
ABSA_CLIENT_SECRET=
ABSA_MTLS_CERT_PATH=
ABSA_MTLS_KEY_PATH=

# LexisNexis WinDeed
WINDEED_API_KEY=
WINDEED_API_URL=https://api.windeed.co.za/v1

# Deeds Office
EDRS_API_URL=
EDRS_CERTIFICATE_PATH=

# TEE
ENCLAVE_PCR0_HASH=
TEE_PROVIDER=aws_nitro   # or azure_confidential

# Alerting
SOC_SLACK_WEBHOOK=
CISO_EMAIL=
GOAML_OUTPUT_DIR=./docs/audit/goaml

# Blockchain (Polygon)
PRIVATE_KEY=
RPC_URL=https://rpc-amoy.polygon.technology
CIRCUIT_BREAKER_ADDRESS=0x770342c49e1F4710E0Eed605dCe41e7f3F7600Eb
```

---

## Key Non-Negotiables

1. The TEE enclave's private key **never leaves the hardware boundary**.
2. PII sanitization in audit logs is **hardware-enforced**. Exported logs contain no raw identity data.
3. Circuit trip decisions are **off-chain** (scorer + validator). The on-chain contract enforces only.
4. The bank's existing AML system remains the **authoritative compliance record**. ProofBridge augments it.

---

## Contact

**Technical questions**: divhanimajokweni@gmail.com
**Repository**: https://github.com/divhanimajokweni-ctrl/proofbridge-liner
**Live demo**: Polygon Amoy testnet — operational
**Jurisdiction**: South Africa | Act 47 of 1937 | FSCA JS2 | Cybercrimes Act 19/2020