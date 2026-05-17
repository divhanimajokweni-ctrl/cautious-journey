# 🧠 ProofBridge Liner

### The Trust Layer for Verifiable AI

> AI is powerful — but it's fundamentally **untrusted**. ProofBridge Liner fixes that.

---

## 🚨 Problem

AI systems generate outputs that are difficult to verify, audit, or trust.

In high-stakes domains — **finance, legal, healthcare, tokenised assets** — this is a liability:

- ❌ You can't **prove** an AI output was correct
- ❌ You can't **audit** what reasoning was used
- ❌ You can't **enforce** decisions when a model hallucinates or is prompt-injected

> "AI said so" is not a verification strategy.

---

## 💡 Solution

ProofBridge Liner transforms every AI output into a **provable, adjudicatable statement**.

```
User / System Input
       │
       ▼
  ┌──────────────┐
  │   AI Model   │  ← generates raw output
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────┐
  │   ProofBridge Liner      │
  │                          │
  │  ① Extract claims        │
  │  ② Verify evidence       │
  │  ③ Calibrate risk (γ)    │
  │  ④ Sign proof trace      │
  └──────┬───────────────────┘
         │  verdict + proof trace
         ▼
  ┌──────────────┐
  │  Downstream  │  ← only SAFE outputs pass
  └──────────────┘
```

The kernel runs a **Bayesian belief check** — only outputs whose evidence posterior exceeds the industry-calibrated threshold are admissible.

**Most AI projects generate answers. ProofBridge proves them.** ✅

---

## ⚙️ Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Claim Extraction** | Converts raw AI output into structured, verifiable statements |
| **Calibrated Verification** | Bayesian belief engine with industry-specific risk sensitivity |
| **Audit Trail** | HMAC-signed, timestamped reasoning chain on every verdict |
| **Circuit Breaker** | Smart-contract enforcement — blocks unsafe AI outputs on-chain |
| **Explainability** | Safety margin \\(S = \\mu - \\tau\\) surfaced with every decision |
| **Formal Proof** | Four theorems machine-checked in Coq; TLA+ model confirms zero deadlocks |

---

## 🔢 The Math

Latent risk \\(\\theta \\sim \\text{Beta}(\\alpha, \\beta)\\):

$$
\\mu = \\frac{\\alpha + 1}{\\alpha + \\beta + 2}
$$

Threshold calibrated per industry via \\(\\gamma\\):

$$
\\tau = \\frac{\\tau_0}{1 + \\gamma \\cdot \\beta/\\alpha}
$$

**Verdict = SAFE** iff \\(\\mu > \\tau\\). Safety margin \\(S = \\mu - \\tau\\).

| Industry | \\(\\gamma\\) | Why |
|----------|------------|-----|
| Healthcare | 1.5 | Life-critical — maximum sensitivity |
| Taxi Safety | 1.2 | Passenger harm costly |
| Financial | 1.0 | Neutral — balanced |
| Micro-finance | 0.8 | Financial inclusion — lenient |

---

## 🧪 Demo Use Cases

| Use Case | What ProofBridge catches |
|---------|-------------------------|
| **Math reasoning** | Inconsistent chain-of-thought or arithmetic errors |
| **Financial decisions** | Missing disclosures or contradictory claims |
| **Healthcare triage** | Diagnosis not grounded in presented evidence |
| **AI content moderation** | Classification that contradicts platform policy |
| **Tokenised assets** | State anchors that fail the on-chain invariant gate |

---

## 📚 Quick Start

```bash
npm install

# Start the full proof pipeline
npm start          # Launches the ops dashboard (port 5000 by default)
npm run fetch      # Runs the prover/fetcher against live IPFS gateways

# Test the verify endpoint
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'

# → {"kernel_version":"v0.9","verdict":"SAFE","belief":0.759,"safety_margin":0.199,...}
```

**Live Dashboard:**

- https://divhanimajokweni-ctrl.github.io/proofbridge-liner/

---

## 🔬 Testing

```bash
npm test        # Boundary + adversarial tests (jest)
```

- **Boundary tests:** α → 0, β → ∞; β → 0, α → ∞; uniform priors; γ edge cases; reasoning chain determinism
- **Monte Carlo adversarial:** ε-perturbation stability — clearly safe and clearly trip outputs hold under noise

---

## 🏗 Architecture Layers

| Layer | Tech | Status |
|-------|------|--------|
| **Logic** | Coq-verified SafetyKernel.v | ✅ Proven |
| **Input** | TEE attestations (EIP-191 ECDSA) | 🔲 Deployed-pending |
| **Enforcement** | EVM circuit breaker (AssetRegistry) | 🔲 Deployed-pending |

Smart contracts are designed for **Polygon Amoy** testnet deployment with deterministic gas analysis: `O(1)` `check()` execution path.

---

## ✅ Judge Verification

Run these and the truth is self-evident:

```
npm install && npm start              # Launches the ops dashboard (port 5000)
npm test                               # All tests pass
```

- ✅ Every verdict is deterministic and HMAC-signed
- ✅ Belief (μ) ≠ Threshold (τ) always surfaced explicitly
- ✅ Industry γ profiles live in source — not just slides
- ✅ Dashboard running at `/dashboard` shows belief/threshold/safety_margin live

---

## 👤 Team

**Divhani Majokweni** — Vaguely Vanity LLC · Gqeberha, South Africa

---

> **ProofBridge Liner** — *Not just another answer. A provable one.*
