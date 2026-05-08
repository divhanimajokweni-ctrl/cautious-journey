# ProofBridge Liner: Regulatory Assurance & Legal Compliance Framework

## 1. FSCA Joint Standard 2 of 2024 (JS2) – Cyber Resilience

**Compliance Status:** HIGH (Automated)

- **Continuous Assurance (Sec 12):** Our TEE-attested Bayesian scoring provides real-time verification of control effectiveness. Every risk score is hardware-signed, fulfilling the mandate for systematic security testing.

- **Incident Reporting (Sec 14):** The `incident-reporter.js` automates the mandatory 24-hour notification window. Class-B threats trigger an immediate, pre-populated report for the FSCA.

## 2. FICA / FIC Amendment Act – Suspicious Activity

**Compliance Status:** HIGH (Automated)

- **Suspicious Activity Reporting (Section 29):** The `fic-sar-exporter.js` generates goAML-compliant XML files for risk scores >0.95. This moves the bank from manual detection to automated regulatory fulfillment.

## 3. Cybercrimes Act 19 of 2020 – Evidence Handling

**Compliance Status:** FORENSIC GRADE

- **Preservation of Evidence:** The `forensic-preservation.js` module seals the original deed payload, metadata, and hardware attestation into a SHA-512 hashed bundle. This satisfies SAPS requirements for chain-of-custody in cyber-fraud prosecutions.

## 4. POPIA – Privacy by Design

**Compliance Status:** COMPLIANT

- **Data Minimisation:** The `pii-sanitizer.js` ensures that only non-PII hashes and CIDs are stored in long-term audit logs. Full data stays within the TEE enclave memory and is never exposed to the host OS.

## 2. Strategic "Positioning" Final Check

Before you hit "Send" on Monday morning to Kellan Moodley (Standard Bank) or Albert Krieg (Absa), ensure your repository has these final "Air-Gapped" configurations:

* The "Silent Tripwire": Ensure simulate-red-team-attack.js is the first item mentioned in your Quick Start. It's the "Wow" factor that proves the JS2 alert works in real-time.

* The Gamma Pivot: Confirm that your Disaster Recovery doc clearly states: "If the hardware fails, we don't open the gates; we tighten the γ threshold to 50:1."

* The Unit Economics: Your R150/year + 5% Equity model should be presented as "Capital Asset Protection," not a software license fee.