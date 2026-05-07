# ProofBridge Liner

**Probabilistic trust infrastructure for South African property transfer integrity.**

ProofBridge Liner is an open‑source safety kernel that provides Bayesian risk stratification, hardware‑attested execution (TEE), and automated regulatory compliance for mortgage collateral transactions. It is designed to reduce institutional uncertainty in the South African deeds registration environment while remaining compliant with Act 47 of 1937, the e‑DRS Act, JS2, POPIA, and FICA.

---

## What Problems Does It Solve?

- **Binary fraud checks** that block legitimate transfers due to administrative noise (typos, date mismatches).
- **"Consensus on garbage"** – digital validation without structural oversight.
- **Manual regulatory reporting** that delays incident notification and increases compliance cost.
- **Lack of tamper‑proof audit trails** when title fraud is suspected.

## What It Provides

| Capability                         | Implementation                                                                 |
|------------------------------------|--------------------------------------------------------------------------------|
| **Class‑Stratified Bayesian Scoring** | Distinguishes Class‑A (administrative noise) from Class‑B (structural fraud) using historical deed evidence. |
| **Trusted Execution Environment (TEE)** | Ensures risk‑scoring logic cannot be tampered with, providing cryptographically signed attestations. |
| **Automated Compliance Workflows** | Generates FSCA JS2 incident reports, FIC SAR (goAML XML), and SAPS forensic evidence bundles on Class‑B events. |
| **Immutable Audit Trails**         | Hardware‑signed, PII‑sanitised `.jsonl` logs, with forensic sealing under the Cybercrimes Act. |
| **CID‑Scoped Thresholds**          | Each property's risk threshold is calibrated independently to prevent data leakage. |

---

## Architecture

```
┌─────────────────┐    ┌──────────────────────────────┐
│ Deed Data Source │───▶│  adapters/deeds-registry.js   │
│ (WinDeed/Light-  │    │  (mocked for sandbox)         │
│  stone/e-DRS)    │    └───────────────┬──────────────┘
└─────────────────┘                    │
                                       ▼
┌─────────────────────────────────────────────────┐
│              prover/main.js                       │
│  StratifiedProver.evaluate()                      │
│    - Bayesian scoring (20:1 cost‑ratio)           │
│    - TEE attestation check                        │
│    - e‑DRS flag handling                          │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│         scripts/generate-compliance-logs.js      │
│  - Attestation‑signed log                        │
│  - High‑risk event orchestrator                  │
│      ├── forensic-preservation.js (SAPS)        │
│      ├── incident-reporter.js (FSCA JS2)        │
│      ├── fic-sar-exporter.js (FIC goAML)         │
│      └── pii-sanitizer.js (POPIA)                │
└─────────────────────────────────────────────────┘
```

**Current deployment environment:**  
Polygon Amoy testnet, with deed data integration via WinDeed sandbox. Not yet audited for production mainnet.

---

## Quick Start

```bash
git clone https://github.com/your-org/proofbridge-liner.git
cd proofbridge-liner
chmod +x setup.sh && ./setup.sh
# Run demo (simulated administrative & fraud scenarios)
node demo-simulation.js
# Full red‑team pipeline test (triggers all regulatory reports)
node scripts/simulate-red-team-attack.js
```

---

## Governance & Human Oversight

ProofBridge Liner operates as a **decision‑support and risk‑escalation system**.  
The final determination of title validity, fraud adjudication, regulatory reporting, and transaction suspension remains subject to qualified human review and applicable South African law. The platform provides probabilistic risk scoring, anomaly detection, attestation validation, and compliance workflow automation to support institutional decision‑making processes.

---

## What This Is Not

- This is **not** a title insurance product.
- This is **not** a legal opinion on deed validity.
- This is **not** a replacement for conveyancers, the Deeds Office, or human underwriters.

---

## Performance Notes

In sandbox testing with simulated historical deed data (up to 500 concurrent evaluations), the kernel exhibits latency below 1 ms per evaluation. These benchmarks have not been certified by an independent third party.

---

## Roadmap

- **v1.2** – Real‑time WinDeed API integration (sandbox)
- **v1.3** – ZK‑Proofs for privacy‑preserving title verification
- **v2.0** – Federated risk intelligence via MPC (bank consortium)
- **Long‑term** – Longitudinal fraud intelligence graphs and repeat‑risk actor detection

---

## Contact & Institutional Inquiries

For access to the Regulatory Assurance Pack or institutional partnership discussions, please open an issue or contact the maintainers.

---

---

## 📚 Documentation

- **[Developer Onboarding Guide](./docs/DEVELOPER_ONBOARDING_GUIDE.md)**: 14-day sandbox integration guide for technical teams
- **[Evidence of Operating Effectiveness](./docs/EVIDENCE_OF_OPERATING_EFFECTIVENESS.md)**: Red team simulation results demonstrating regulatory compliance
- **[Regulatory Assurance Pack](./docs/REGULATORY_ASSURANCE_PACK.md)**: Institutional compliance documentation
- **[Institutional Deck](./docs/INSTITUTIONAL_DECK.md)**: Executive summary for bank leadership

**License:** [to be added]