# Video Demo Script — ProofBridge Liner
**Duration:** 90 seconds
**Format:** Screen recording + voice-over
**Presenter:** Mihle "Divhani" Majokweni

---

## [00:00–00:10] Scene 1 — The Problem

**Visual:** Blank screen → headline "AI SAYS SO" flashes red  
**Voice-over:**
> "AI systems produce outputs that are impossible to verify, audit, or enforce. In high-stakes domains — finance, healthcare, tokenised property — that's not just a risk. It's a liability."

---

## [00:10–00:20] Scene 2 — The Math

**Visual:** Title card. **ProofBridge Liner — The Trust Layer for Verifiable AI**  
Then the kernel modal on screen:

```
μ = (α + 1) / (α + β + 2)   ← Bayesian belief
τ = τ₀ / (1 + γ · β/α)     ← Calibrated threshold
Verdict = SAFE  iff  μ > τ
Safety Margin  S = μ − τ
```

**Voice-over:**
> "ProofBridge Liner runs a Bayesian belief check at every output. The calibrated threshold adjusts the risk sensitivity per industry — Finance is neutral, Healthcare is strict, Micro-finance is lenient. The verdict: SAFE or TRIP. The safety margin is always surfaced."

---

## [00:20–00:55] Scene 3 — Live Dashboard Walkthrough

**Visual:** Browser opens → `divhanimajokweni-ctrl.github.io/proofbridge-liner/dashboard/`  
(on-screen cursor highlights each area)

| Timestamp | UI Element | VO Line |
|---|---|---|
| 00:20 | Top bar: "PROOFBRIDGE — SAFETY KERNEL // V2.5 — ONLINE" | "This is the ProofBridge Liner dashboard. Uptime is live. The network is measured per refresh." |
| 00:25 | Section 02 — Test Suite: **14/14 PASSED** | "Every test passes. Git-unit verification — gas analysis below 50k. The circuit-breaker logic is deterministic." |
| 00:30 | Section 05 — Deployed Contracts (Polygon Amoy, chain 80002) | "The CircuitBreaker smart contract is live on Polygon Amoy... 0-of-5 quorum enforced." |
| 00:35 | Section 07 — Monitored Assets table (IPFS CID, Expected Hash, Status) | "Tokenised RWA deeds are indexed. Each asset has an IPFS CID, a deed hash, and a resolution status — fresh, mismatched, or unreachable." |
| 00:40 | Section 08 — 5-node signer quorum | "Five signature nodes form the quorum. Three of five signatures required to gate any on-chain action." |
| 00:45 | Section 09 — Last Fetcher Run | "The fetcher crawls five IPFS gateways in parallel. Hash delivery compared against expected values." |
| 00:50 | [VERIFICATION BADGE] green → "🛡️ VERIFIED SOVEREIGN TRUTH" + score | "The verification badge confirms the safety margin in real time. Positive margin — SAFE. Negative — TRIP, with the circuit breaker flagging every downstream contract." |

---

## [00:55–01:10] Scene 4 — API Verify Endpoint

**Visual:** Terminal. Cursor types:

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'
```

Terminal responds:

```json
{
  "kernel_version": "v0.9",
  "verdict": "SAFE",
  "belief": 0.759,
  "threshold": 0.514,
  "safety_margin": 0.245,
  "reasoning_chain": [
    { "step_id": "posterior_compute",   "computed_value": 0.759 },
    { "step_id": "threshold_calibrate", "computed_value": 0.514 },
    { "step_id": "decision_compare",    "computed_value": "SAFE (margin=0.245)" }
  ],
  "signature": "a3f2e…(HMAC-SHA256)"
}
```

**Voice-over:**
> "That live verify endpoint at `/api/verify` runs the full Bayesian pipeline and returns every intermediate value: posterior belief, calibrated threshold, safety margin, the three-step reasoning chain, and a cryptographic signature. Every verdict is deterministic and auditable."

---

## [01:10–01:35] Scene 5 — Architecture Diagram + Smart Contracts

**Visual:** ARCHITECTURE.md diagram or a rendered schematic:

```
User / AI Output
       │
       ▼
  ┌────────────┐
  │  AI Model  │
  └─────┬──────┘
        │
        ▼
  ┌──────────────────────────────────────┐
  │         PROOFBRIDGE LINER            │
  │  ① Extract claims                    │
  │  ② Bayesian belief check (μ)         │
  │  ③ Calibrate via γ threshold         │
  │  ④ Sign proof trace (HMAC)           │
  └──────────────┬───────────────────────┘
                 │  verdict + proof trace
                 ▼
  ┌────────────────┐
  │  Downstream    │  ← only SAFE outputs pass
  │  circuit       │    TRIP → on-chain halt
  │  breaker       │
  └────────────────┘
```

**Voice-over:**
> "Downstream systems only receive SAFE outputs. A TRIP hits the on-chain CircuitBreaker — an EVM smart contract with access-controlled transfer gating and a threshold quorum. No gate bypass. No hot wallet signing. The entire chain is HMAC-signed and timestamped."

Layer callouts on screen:

| # | Layer | Artifact |
|---|---|---|
| 1 | Logic | Coq-verified SafetyKernel.v — proven theorems |
| 2 | Input | TEE attestations — EIP-191 ECDSA |
| 3 | Enforcement | CircuitBreaker.sol — O(1) check(), <50k gas |

---

## [01:35–01:45] Scene 6 — Closing

**Visual:** Title card on dark background:  
**PROOFBRIDGE LINER — The Trust Layer for Verifiable AI**  
Subtitle: Built by Divhani Majokweni | Vaguely Vanity LLC | Gqeberha

GitHub logo + link: `github.com/yourusername/proofbridge-liner`  
Vercel logo + link: live dashboard URL

**Voice-over:**
> "ProofBridge Liner turns every AI output into a provable, adjudicatable statement. Deterministic. Auditable. Timestamped.
>
> Thank you."

---

## Production Notes

| Item | Detail |
|---|---|
| Voice recording | Audacity / OBS → export as MP4 overlay |
| Screen capture | OBS at 1080p, 30fps |
| Timeline | 90 seconds total (trim Scene 5 if running long) |
| Music | Minimal ambient — no vocals |
| Accessibility | Burn subtitles; upload to YouTube/Lablab |
| Output | `demo/video-demo.mp4` (≤50 MB for upload) |
