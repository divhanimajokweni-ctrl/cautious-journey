# Skill: Forensic Preservation for Cyber-Fraud Prosecution
**Goal:** Create an immutable, cryptographically sealed chain-of-custody for Class-B risk events.

## Workflow
1. **Trigger:** Activated when `StratifiedProver.evaluate()` returns `action: ESCALATE_TO_RISK_DESK` AND `isActionable: false`.
2. **Payload Capture:** Extract the raw JSON deed payload before PII sanitization.
3. **Hardware Binding:** Fetch the **PCR0 Hash** from the AMD MI300X TEE.
4. **Hashing:** Generate a SHA-512 checksum of the combined Payload + Metadata.
5. **Sealing:** Encrypt the bundle using the Enclave's private key.
6. **Storage:** Write to the `docs/audit/forensics/` directory with a unique `BUNDLE_ID`.

## JS2 Compliance Note
Satisfies Section 12 (Oversight) and Section 14 (Incident Notification) by ensuring the "Material Incident" report is backed by hardware-attested evidence.