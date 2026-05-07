# ProofBridge Liner — Regulatory Assurance Pack

**Version:** v1.1.1
**Classification:** Confidential — Institutional Use Only
**Last Updated:** May 7, 2026

---

## 1. Purpose & Scope

This document describes the operational, compliance, and risk controls of ProofBridge Liner ("the Platform") as a **probabilistic trust infrastructure** for South African property transfer integrity. It is designed to assist regulated entities in meeting their obligations under:

- The Deeds Registries Act (Act 47 of 1937)
- The Electronic Deeds Registration Systems Act (e‑DRS)
- Joint Standard 2 of 2024 (JS2) on Cybersecurity and Cyber Resilience
- Protection of Personal Information Act (POPIA)
- Financial Intelligence Centre Act (FICA)
- Cybercrimes Act 19 of 2020

---

## 2. Data Lineage & Integrity

### 2.1 Deed Data Sources
- Primary: LexisNexis WinDeed / Lightstone APIs (sandbox in current demonstration)
- Secondary: Electronic Deeds Registration System (e‑DRS) digital signatures when available
- Tertiary: Deeds Office Tracking System (DOTS) manual fallback

All deed record fetching is encapsulated in `adapters/deeds-registry.js`. Raw data is logged for forensic purposes only during high‑risk events and is otherwise discarded after evaluation.

### 2.2 Data Integrity
- Each deed record is referenced by a Content Identifier (`cid`), anchoring verification to a specific evidentiary record.
- Bayesian scoring is performed inside a **Trusted Execution Environment (TEE)** ; the code image is measured (PCR0 hash) and recorded in every audit log.
- Any modification of the scoring logic after deployment will produce a different PCR0, rendering all subsequent logs non‑matching.

---

## 3. Audit Methodology

### 3.1 Log Generation
- Every evaluation produces a **hardware‑signed attestation log** (`scripts/generate-compliance-logs.js`).
- The log includes: CID, risk score, risk class, threshold used, action (PROCEED/ESCALATE), PCR0 hash, and a cryptographic signature.
- Logs are written to monthly `.jsonl` files in `docs/audit/`.

### 3.2 PII Sanitisation (POPIA)
- Before log writing, all personally identifiable information (owner names, ID numbers, addresses) is irreversibly hashed using `scripts/pii-sanitizer.js`.
- Raw PII is never persisted in the audit trail. Unredacted data is only sealed in forensic bundles for SAPS upon a confirmed high‑risk event.

### 3.3 Forensic Evidence Bundles (Cybercrimes Act)
- When a Class‑B (Structural/Fraud) event is detected and the transaction is blocked, the Platform automatically creates a **sealed evidence bundle** (`scripts/forensic-preservation.js`).
- The bundle contains the raw deed payload, the risk evaluation, and the TEE attestation, all hashed with SHA‑512 to ensure chain‑of‑custody integrity.

---

## 4. Regulatory Workflow Automation

### 4.1 FSCA JS2 Incident Reporting
- Class‑B events with `isActionable=false` trigger `scripts/incident-reporter.js` to generate a JS2‑compliant notification.
- The report includes incident description, technical analysis, impact assessment, and regulatory alignment.
- The system prepares the report within seconds of detection, enabling the institution to meet the 24‑hour notification mandate.

### 4.2 FICA Suspicious Activity Reporting (SAR)
- If the Bayesian posterior score exceeds 0.95 (indicating high confidence of fraud), `scripts/fic-sar-exporter.js` generates an XML SAR in goAML‑compatible format.
- This can be directly ingested by the bank's FIC reporting gateway.

### 4.3 Human‑In‑The‑Loop
- All generated reports are flagged for human review before submission to authorities.
- The Platform does **not** automatically dispatch reports to regulators; it prepares the documentation and escalates to a designated compliance officer.

---

## 5. Operational Boundaries & Production Definition

- **Current Phase:** Live monitored pilot environment on Polygon Amoy testnet.
- **Data Integration:** WinDeed sandbox (non‑production) and mock datasets.
- **Production Deployment:** Has not been independently audited. Production designation will require:
  - Third‑party security audit of the TEE enclave
  - Independent validation of Bayesian model against a representative deed dataset
  - Formal agreement with a regulated financial institution
- **Not Yet in Scope:** Smart contract enforcement on mainnet; fully autonomous transaction blocking without human override.

---

## 6. Threat Model (Abridged)

| Threat Actor / Vector                 | Mitigation                                                                 |
|----------------------------------------|----------------------------------------------------------------------------|
| **Adversarial conveyancer submitting forged documents** | Bayesian Class‑B threshold triggers when `mismatchCount > 1` or TEE fails. |
| **Insider tampering with scoring kernel**             | TEE attestation ensures code identity; any change breaks PCR0 signature.   |
| **Deeds Registry API poisoning**                     | Hybrid fallback (multiple data sources); mismatch count increases, triggering higher scrutiny. |
| **Large‑scale identity fraud ring**                   | CID‑scoped thresholds prevent global contamination; repeated anomalies build a negative history (beta) that lowers posterior score. |
| **TEE hardware compromise**                           | Immediate SOC alert and gamma‑pivot to γ=50; transactions routed to manual review. |

---

## 7. Data Retention & POPIA Compliance

- Audit logs: Retained for a minimum of 5 years in compliance with financial record‑keeping obligations.
- Forensic evidence bundles: Sealed and stored for legal preservation; access restricted to authorised personnel.
- Raw PII: Never retained beyond the ephemeral TEE memory during evaluation.
- All data at rest is hashed or encrypted; no PII is stored in cleartext.

---

## 8. Legal Disclaimers

> ProofBridge Liner is a **probabilistic decision‑support system**. It does not provide legal advice, title opinions, or definitive fraud adjudication. All outputs must be interpreted by qualified professionals within the framework of South African law. The Platform's developers make no warranty of fitness for a particular purpose and accept no liability for actions taken based on its outputs without independent verification.

---

## 9. Contact for Regulators

Institutional auditors and regulators may request additional documentation (e.g., full threat matrix, code audit reports, test coverage) by contacting [designated contact].