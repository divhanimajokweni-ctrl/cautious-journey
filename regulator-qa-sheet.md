# ProofBridge Liner — Regulator Q&A Anticipation Sheet

**Document Type:** Anticipated Regulatory Questions & Responses  
**Project:** ProofBridge Liner  
**Version:** Safety Kernel v1.0 (Frozen)  
**Status:** Informational Preparation Guide  
**Intended Use:** Internal preparation for regulatory dialogue

---

## Purpose

This sheet anticipates the **10 most likely regulatory questions** about ProofBridge Liner, based on historical patterns in tokenized asset regulation. Responses are structured to be:

* **Fact-based** (reference the code and artifacts)
* **Conservative** (no overclaims)
* **Transparent** (acknowledge limitations)
* **Actionable** (suggest next steps)

> **This is preparation material, not legal advice.**

---

## Q1: What is ProofBridge Liner's regulatory classification?

**Anticipated Question:** "How should we classify this system under securities/property law?"

**Response:**
"ProofBridge Liner is a risk-control infrastructure component, not a substantive regulatory compliance tool. It operates analogously to a trading halt mechanism in traditional markets - preventing activity when material uncertainty exists. It does not make legal determinations, provide certifications, or substitute for court/regulatory authority. Classification would depend on specific jurisdictional frameworks, but Liner itself does not change the regulatory status of the underlying assets."

**Evidence Reference:** Safety Kernel v1.0 invariants, Regulatory Reading Guide Section 4.

---

## Q2: Who bears liability if the circuit trips incorrectly?

**Anticipated Question:** "What happens if trading halts inappropriately?"

**Response:**
"The issuer retains full liability for legal accuracy and reset decisions. Liner enforces pauses when off-chain provers detect hash mismatches, but the issuer must investigate and manually reset the circuit. False positives create operational friction but do not expose regulators to liability. The system defaults to inactivity under uncertainty, which is a conservative regulatory posture."

**Evidence Reference:** CircuitBreaker.sol reset() function (issuer-only access), Risk Event Memo.

---

## Q3: How do you ensure oracle reliability?

**Anticipated Question:** "What prevents oracle manipulation or single points of failure?"

**Response:**
"The MVP uses a single oracle for simplicity and auditability. Oracle authority is limited to proof updates and circuit trips - no asset transfers, minting, or value manipulation. Future versions may implement threshold consensus, but v1.0 prioritizes transparency over redundancy. Oracle identity is on-chain and verifiable."

**Evidence Reference:** CircuitBreaker.sol access controls, Trust Model documentation.

---

## Q4: Does this create systemic risk concentration?

**Anticipated Question:** "What if many assets trip simultaneously?"

**Response:**
"Liner is designed for asset-specific enforcement, not systemic halts. Each asset's circuit is independent, governed by its own legal document hash. A widespread trip would indicate a systemic legal issue (e.g., registry compromise), not a technical failure. The architecture supports gradual adoption without creating single points of systemic risk."

**Evidence Reference:** Per-asset hash mapping in CircuitBreaker.sol, singleton pattern design.

---

## Q5: How does this interact with existing compliance obligations?

**Anticipated Question:** "Does this reduce issuer regulatory burdens?"

**Response:**
"Liner provides a technical enforcement layer but does not reduce substantive compliance obligations. Issuers remain responsible for legal accuracy, disclosure, and regulatory filings. Liner reduces operational risk by preventing trading on stale facts, but does not automate compliance or substitute for professional legal counsel."

**Evidence Reference:** Regulatory Reading Guide Section 6 (Human Accountability Preserved).

---

## Q6: What audit trail exists for enforcement actions?

**Anticipated Question:** "How can we verify circuit trip decisions?"

**Response:**
"All circuit actions are logged as immutable on-chain events: CircuitTripped(reason) and CircuitReset(). Event data includes timestamps, asset IDs, and human-readable reasons. Off-chain provers maintain detailed logs of hash comparisons. The entire system is designed for forensic auditability."

**Evidence Reference:** CircuitBreaker.sol event emissions, Ghost-Risk Audit Report Template.

---

## Q7: Can this be used across jurisdictions?

**Anticipated Question:** "Is this limited to specific legal systems?"

**Response:**
"Liner is jurisdiction-agnostic. It enforces based on cryptographic document hashes without encoding legal interpretations. It can operate in civil-law, common-law, or hybrid systems. Jurisdiction-specific compliance (e.g., local registry integration) remains issuer-managed and outside Liner's scope."

**Evidence Reference:** Regulatory Reading Guide Section 8 (Jurisdictional Neutrality).

---

## Q8: What happens during network outages or IPFS failures?

**Anticipated Question:** "What are the failure modes?"

**Response:**
"Liner implements fail-closed logic: if provers cannot verify document integrity, circuits trip to prevent trading on uncertain facts. This is a conservative approach - temporary outages cause temporary halts rather than continued trading on potentially stale data. Multi-gateway IPFS design reduces single-point failures."

**Evidence Reference:** Prover multi-gateway fallback, CircuitBreaker.sol fail-closed modifiers.

---

## Q9: How does this differ from existing oracle services?

**Anticipated Question:** "Why not use Chainlink or similar?"

**Response:**
"Existing oracles publish data feeds; Liner enforces transaction halts. The difference is architectural: Liner embeds enforcement inside the transfer path itself. This creates atomic reverts rather than requiring secondary monitoring and intervention. Liner complements, rather than competes with, data oracles."

**Evidence Reference:** Strategic Positioning vs. Chainlink (Integration Guide).

---

## Q10: What are the production readiness requirements?

**Anticipated Question:** "What needs to happen before live deployment?"

**Response:**
"V1.0 is research-grade. Production would require: multi-oracle consensus, hardware-backed key custody, comprehensive third-party audit, and issuer-specific legal review. The current release establishes technical feasibility and economic viability for further development."

**Evidence Reference:** Forward-Compatibility Statement, Exclusions (Class A Release Spec).

---

## Preparation Notes

**Tone Guidelines:**
- Be factual, not defensive
- Reference artifacts, not opinions
- Acknowledge limitations proactively
- Suggest issuer responsibility clearly

**Escalation Triggers:**
- If questions involve specific securities law interpretations
- If requests for legal opinions or compliance certifications
- If demands for production deployment guarantees

**Next Steps:**
Consult qualified legal counsel for jurisdiction-specific guidance.

---

**End of Regulator Q&A Anticipation Sheet**