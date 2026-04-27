# ProofBridge Liner — Risk Event Memo

**Hypothetical Scenario:** The "Silent Lien" Incident  
**Date:** 2026-04-27  
**Prepared for:** Issuer Legal & Compliance Teams, Board Risk Committee  

---

## Incident Overview

### The Trigger Event
A $2.5M tokenized single-family property (RealT-style) undergoes a routine legal update: a second mortgage lien is recorded in the county registry. The lien is legitimate but changes the property's deed hash from `0xabc123...` to `0xdef456...` (a 1-byte difference in the PDF metadata).

### Without ProofBridge Liner (Current Market Reality)
1. **Legal Update Occurs:** Issuer updates the deed in the county system but forgets to update the on-chain hash.
2. **IPFS Content Changes:** The deed PDF is re-uploaded with the lien notation, changing its SHA-256 hash.
3. **Trading Continues Unaware:** On-chain token trading proceeds normally for 3 weeks.
4. **Discovery:** During quarterly audit, compliance team identifies the hash mismatch.
5. **Crisis Erupts:**
   - **14 token transfers** occurred during the mismatch period ($350k in volume).
   - All transfers are **retroactively illegal** (trading on stale legal basis).
   - Issuer faces:
     - Regulatory fines (potential SEC action for unregistered securities violations).
     - Civil lawsuits from secondary buyers claiming fraud/misrepresentation.
     - Complete portfolio freeze while legal teams unwind trades.
     - Reputational damage halting future tokenization deals.
   - **Total Cost:** $500k–$2M in legal fees, settlements, and lost business.

### With ProofBridge Liner (Enforced Prevention)
1. **Legal Update Occurs:** Same lien recording.
2. **Prover Detects Mismatch:** Within 5 minutes, the off-chain prover fetches the updated deed, computes the new hash, and identifies the divergence.
3. **Circuit Trips Automatically:** `tripCircuit(reason: "Deed hash mismatch - lien recorded")` executes on-chain.
4. **Trading Halts Instantly:** All subsequent token transfers revert with `"Liner: Trading halted due to legal discrepancy"`.
5. **Issuer Resolution:** Legal team reviews the lien, confirms legitimacy, and executes `reset()` to restore trading.
6. **No Illegal Trades:** Zero transfers occur during the mismatch window.
7. **Total Disruption:** 15 minutes of halted trading (vs. weeks of crisis).
8. **Cost Impact:** <$0.01 gas fee for the trip transaction.

---

## Comparative Impact Analysis

| Dimension | Without Liner | With Liner |
|-----------|---------------|------------|
| **Detection Time** | 3 weeks (audit) | 5 minutes (automated) |
| **Illegal Trades** | 14 transfers ($350k) | 0 transfers ($0) |
| **Legal Exposure** | High (fraud claims, SEC scrutiny) | None (prevented) |
| **Resolution Time** | Weeks (legal unwind) | Minutes (reset button) |
| **Reputation Impact** | Severe (market confidence lost) | Minimal (transparent safety) |
| **Total Cost** | $500k–$2M | <$0.01 |

---

## Key Risk Insights

### Why This Matters Now
- **Tokenization Growth:** 2026 sees accelerated RWA tokenization (RealT at $500M+ AUM, competitors following).
- **Regulatory Scrutiny:** SEC's 2025 crypto guidance explicitly addresses "material changes" in tokenized assets.
- **Market Maturity:** Investors increasingly demand institutional-grade controls.

### Why Liner Prevents This Class of Event
- **Atomic Enforcement:** Circuit breaker operates at the EVM level — no human discretion required.
- **Fail-Closed Design:** Default state is "halt" when uncertainty exists.
- **Zero False Positives:** Only trips on cryptographic proof mismatch (not heuristics).
- **Issuer Control:** Reset authority remains exclusively with the asset owner.

### Without Liner, This Is Inevitable
Every tokenized property undergoes legal changes (liens, title updates, conveyances). Without automated hash verification, mismatches are statistical certainty. Human processes (audits, notifications) are too slow and error-prone for on-chain velocity.

---

## Recommendation

**Immediate Integration Priority:**  
Implement ProofBridge Liner on all tokenized portfolios before Q2 2026 regulatory deadlines.

**Implementation Cost:**  
Free integration + 1% equity carry (non-dilutive to issuer economics).

**Risk Mitigation Value:**  
Eliminates catastrophic "silent lien" scenarios that could destroy tokenization business models.

---

**Prepared by:** ProofBridge Liner Safety Team  
**Classification:** Internal Use Only — Suitable for Issuer Due Diligence