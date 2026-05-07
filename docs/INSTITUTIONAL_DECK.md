# ProofBridge Liner: Institutional Trust Infrastructure for SA Property Transfers

## 1. The Problem
- **R1.5 trillion mortgage market** underpinned by legacy, reactive fraud detection.
- Banks face a binary choice: high operational friction (manual checks) or catastrophic collateral loss.
- Current tools (WinDeed, Lightstone) provide post‑event reports, not pre‑registration prevention.
- New regulations (JS2, e‑DRS, Cybercrimes Act) require 24‑hour incident reporting and forensic readiness – manual workflows cannot scale.

## 2. The Solution
ProofBridge Liner is a **probabilistic trust orchestration layer** that sits between the deeds registry and the bank's asset book. It provides:

- **Bayesian risk stratification** (20:1 cost‑ratio) → minimises false positives while catching structural fraud.
- **Hardware‑attested execution** (TEE) → scoring logic is tamper‑proof, with cryptographic proof.
- **Automated regulatory compliance** → JS2 reports, FIC SARs, and SAPS evidence bundles triggered in real time.
- **Forensic auditability** → every decision is hardware‑signed and verifiable, reducing liability and insurer friction.

## 3. Strategic Moat
Our moat is not blockchain. It is **compliance automation + forensic trust**.
We reduce the operational risk and regulatory burden of property transfers, making the bank's collateral book safer and more efficient.

## 4. Economics of Fraud Prevention
- **False Positive (block a valid transfer):** ~R5,000 cost (manual review delay).
- **False Negative (miss a R2M fraud):** loss of first‑ranking bond, legal costs, reputational damage.
- **γ = 20** → banks avoid 20x more expensive errors while maintaining liquidity.

## 5. Operational Metrics (Sandbox)
- **Latency:** <1 ms per evaluation (500 TPS simulated).
- **Automation:** 90% of Class‑A administrative noise passes without human intervention.
- **Block Rate:** In sandbox tests with historical fraud patterns, no false negatives observed; all structured fraud scenarios correctly escalated.

## 6. Deployment Status
- **Live monitored pilot** on Polygon Amoy testnet with WinDeed sandbox data.
- Ready for 30‑day shadow pilot with a partner bank's special‑risks book.

## 7. Compliance Automation in Action
One Class‑B detection automatically:
1. Blocks the registration instruction.
2. Generates a JS2 incident report (FSCA ready).
3. Exports a FIC SAR XML (goAML compatible).
4. Seals a forensic evidence bundle for SAPS (Cybercrimes Act).
5. Alerts the CISO via Slack/Email.

## 8. Roadmap to National Infrastructure
- **v1.2** – Live Deeds Office API integration and TEE audit.
- **v2.0** – Federated fraud intelligence via MPC (bank consortium).
- **Long‑term** – Longitudinal anomaly graphs and repeat‑risk actor detection → industry‑wide trust layer.

## 9. Why Now
- JS2 enforcement began June 2025; banks face penalties for non‑compliance.
- e‑DRS rollout increases digital attack surface.
- SABRIC reports 86% rise in digital banking fraud.
- ProofBridge Liner converts regulatory burden into automated assurance.

---

**Contact:** [Your details]
**Repository:** [GitHub URL]