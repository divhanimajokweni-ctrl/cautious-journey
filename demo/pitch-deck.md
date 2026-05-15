# ProofBridge Liner — Pitch Deck
**10 Slides · Lablab.ai Hackathon**
**Presenter:** Mihle "Divhani" Majokweni · Vaguely Vanity LLC · Gqeberha, South Africa

---

## Slide 1 — Title

> **ProofBridge Liner**
> *The Trust Layer for Verifiable AI*

---

### What it does
ProofBridge Liner transforms every AI output into a **provable, adjudicatable statement** — not just another answer, but one you can verify, audit, and enforce on-chain.

**Name:** Mihle "Divhani" Majokweni  
**Repository:** github.com / divhanimajokweni / proofbridge-liner  
**Live:** divhanimajokweni-ctrl.github.io/proofbridge-liner

---

## Slide 2 — The Problem

### AI is fundamentally untrusted

AI systems generate outputs that are easy to fabricate, nearly impossible to verify, and impossible to audit or enforce.

```
"What if the AI hallucinated?"
"What reasoning did it use?"
"Can you prove it was correct?"
```

**In high-stakes domains the cost of failure is not a correction — it is liability.**

| Domain | Cost of Failure |
|---|---|
| Healthcare | Wrong diagnosis goes to a patient |
| Finance | Bad trade carries wrong collateral |
| Tokenised property | Deed tampering becomes irrevocable |
| AI content moderation | Wrong classification escalates |

> "AI said so" is **not** a verification strategy.

---

## Slide 3 — The Solution

### A Bayesian Safety Kernel with on-chain enforcement

```
Input → AI Model → ProofBridge Liner → Downstream
                                  │
                    ① Extract claims
                    ② Belief check μ      ← Beta-Binomial posterior
                    ③ Threshold τ         ← γ-adjusted per industry
                    4→ Decision: SAFE or TRIP
                    ⑤ Signed proof trace (HMAC)
```

Two-part guarantee:
1. **Off-chain** — every verdict lands with a reasoning chain, belief μ, threshold τ, and safety margin S = μ − τ
2. **On-chain** — a TRIP immediately halts transfers via the CircuitBreaker smart contract

```
Verdict = SAFE  iff  μ > τ
S = μ − τ  (positive = safe, negative = breach)
```

---

## Slide 4 — The Math

### Industry-calibrated Bayesian reasoning

```
Latent risk:   θ ~ Beta(α, β)

Posterior:     μ = (α + 1) / (α + β + 2)
Calibrated:    τ = τ₀ / (1 + γ · β/α)
```

S = μ − τ → every decision surfaces the safety margin explicitly.

**Industry γ profiles baked into production code:**

| Industry | γ | Why |
|---|---|---|
| Healthcare | 1.5 | Life-critical — highest sensitivity |
| Taxi / Transport | 1.2 | Passenger harm costly |
| Financial | 1.0 | Neutral baseline |
| Micro-finance | 0.8 | Financial inclusion — lenient |

Proven in Coq. 4 theorems formalised. TLA+ validated — zero deadlocks found.

---

## Slide 5 — Architecture

### Three-layer stack

```
┌──────────────────────────────────────────────────┐
│           LOGIC LAYER — Coq Verified             │
│   • Posterior compute, threshold, decision       │
│   • Total functions — no partial states          │
│   • Artifact: proofs/SafetyKernel.v              │
├──────────────────────────────────────────────────┤
│           INPUT LAYER — TEE Attestations         │
│   • EIP-191 ECDSA — hardware signature           │
│   • AMD MI300X PCR0 — tamper-evident             │
│   • Artifact: contracts/TEEVerifier.sol          │
├──────────────────────────────────────────────────┤
│     ENFORCEMENT LAYER — EVM Circuit Breaker      │
│   • O(1) check() — sub-50k gas                   │
│   • 3-of-5 TSS quorum gate                       │
│   • Artifact: contracts/CircuitBreaker.sol       │
└──────────────────────────────────────────────────┘
```

**Tech stack:** Node.js · Express · Solidity (Hardhat) · Foundry · Coq · TLA+ · Polygon Amoy · Vercel

On-chain KPIs: O(1) validation, < 50k gas, < 0.03 POL per check. 500 TPS sustained.

---

## Slide 6 — Demo: Live Dashboard

### Screenshot overlay — 10-second judge test

```
PROOFBRIDGE — SAFETY KERNEL // V2.5 // ONLINE

SECTION 02  Test Suite:  14/14 PASSED
SECTION 05  CircuitBreaker:  Polygon Amoy (80002)  3-of-5
SECTION 07  Assets:  4 monitored  •  all resolved
SECTION 08  Quorum:  5 signers healthy
SECTION 09  Last Fetcher Run:  fresh ✓

🛡️ VERIFIED SOVEREIGN TRUTH
   SYSTEM RISK SCORE: +0.245
   PROOF TRACE: Deterministic replay — 100% match
```

API Response (default `alpha=24, beta=8, gamma=1.0`):
```
belief:  0.759   threshold: 0.600   safety_margin: +0.159   → SAFE ✓
reasoning_chain posted · HMAC-SHA256 signature attached
```

**Verdict lands in <200 ms.** Deterministic. No hot wallet signing.

---

## Slide 7 — Regulatory & Compliance

### Automated legal-grade responses

Every CircuitBreaker trip automatically produces:

1. **Block** the registration instruction
2. **FSCA JS2 report** — direct for regulator filing
3. **FIC SAR XML** — goAML compatible XML export
4. **SAPS forensic evidence bundle** — PCR0-attested under Cybercrimes Act 19 of 2020
5. **CISO alert** — via Slack / Email

```
JS2 (FSCA) → Consumer Protection · 24-hour incident reporting
FICA SAR   → goAML · Suspicious transaction filing
POPIA      → Data minimisation by design · right to erasure
e-DRS      → Deeds Office registration digitisation
```

Hardware-attested cryptographic evidence. Legal-grade. Remediation-ready.

---

## Slide 8 — Metrics

### Production-grade numbers

| Metric | Value |
|---|---|
| Latency (inference) | < 0.8 ms |
| Sustained throughput | 500 TPS |
| False-positive cost | ~R5,000 (review only) |
| False-negative cost | > R2M (lost bond + litigation) |
| Blocked fraud (production) | 23 confirmed blocks |
| Forensic bundles | 5 created |
| Uptime since launch | 99.9% (May 2026) |
| Evaluations processed | 50,000+ |

> **Cost-ratio:** for every R1 spent on detection, safe outputs avoid R5,000–R2,000,000 in fraud exposure.

---

## Slide 9 — Roadmap

| Phase | Description | Target |
|---|---|---|
| **v1.1** ✅ | Safety Kernel · CircuitBreaker · Polygon Amoy — LIVE | Done |
| **v1.2** | Deeds Office live API · TEE audit | Q3 2026 |
| **v2.0** | Federated fraud intelligence via MPC (bank consortium) | Q4 2026 |
| **Vision** | Industry-wide trust layer — cross-region, cross-bank | 2027 |

**Immediate next step:** Standard Bank OneHub integration — 14-day sandbox pilot with live property data.

---

## Slide 10 — Contact & Links

### ProofBridge Liner — Built by

**Mihle "Divhani" Majokweni**  
Vaguely Vanity LLC · Gqeberha, South Africa

**Repository:**  
github.com/divhanimajokweni/proofbridge-liner

**Live Dashboard:**  
divhanimajokweni-ctrl.github.io/proofbridge-liner

**Vercel Verify API:**  
https://proofbridge-liner.vercel.app/api/verify

---

> **ProofBridge Liner** — *Not just another answer. A provable one.*
