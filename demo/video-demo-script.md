# Video Demo Script — ProofBridge Liner
**Duration:** ~105 seconds *(includes 15 s surplus diagram buffer)*
**Format:** Screen recording + voice-over + captions
**Presenter:** Mihle "Divhani" Majokweni

---

## [00:00–00:12] Scene 1 — Opening Hook

**Visual:** Black screen → red headline fades in, holds 3 s:
> **IS YOUR AI'S TRUTH SOVEREIGN OR A LIABILITY?**
> *(no other text on screen)*

**Captions** [bottom of screen, 14 px gray on black]:
> "Without cryptographic proof, AI-generated output has no legal standing."

**Voice-over:**
> "Every AI output that lacks cryptographic proof is a liability — not a statement of fact. That gap is what ProofBridge Liner closes."

---

## [00:12–00:28] Scene 2 — Three-Layer Architecture

**Visual:** Rendered schematic stays on screen for **10 s** *(up from ~5 s)*:

```
User / AI Output
       │
       ▼
 ┌──────────────┐
 │  AI Model    │
 └──────┬───────┘
        │
        ▼
 ┌─────────────────────────────┐
 │     PROOFBRIDGE LINER       │
 │  ① TEE Gate — attest proof │
 │  ② Bayesian belief μ       │
 │  ③ Calibrated threshold τ  │
 │  ④ Sign trace (HMAC)       │
 └────────────┬────────────────┘
              │ verdict
              ▼
        ┌──────────┐
        │ SAFE  ✅ │   ← passes downstream
        │ TRIP  🛑 │   ← halts on-chain
        └──────────┘
```

**On-screen callouts** *(single line per layer, 5 s each → 15 s total dwell)*:

| Layer | One-Line Label |
|---|---|
| ① TEE Gate | Hardware root of trust — EIP-191 ECDSA |
| ② Bayesian Kernel | μ = (α+1)/(α+β+2) — calibrated posterior |
| ③ Threshold | τ = τ₀ / (1 + γ·β/α) |
| ④ HMAC Trace | Every verdict — signed and timestamped |

**Captions** cycle through one callout as each layer highlights.

**Voice-over:**
> "ProofBridge Liner runs a four-stage gate. First, the TEE gate locks the input with hardware attestation. Second, a Bayesian posterior computes belief μ. Third, a calibrated threshold τ varies risk sensitivity by industry — strictest for healthcare, most lenient for micro-finance. Fourth, every verdict is signed and timestamped. No gate bypass, no hot wallet signing."

---

## [00:28–00:55] Scene 3 — Live Dashboard Run

**Visual:** Dashboard loads at `divhanimajokweni-ctrl.github.io/proofbridge-liner/dashboard/`.

**Cursor highlights** each area with a **3 s pause** per section:

| Timestamp | What Cursor Highlights | VO Summary |
|---|---|---|
| 00:28 | Top bar: "PROOFBRIDGE — SAFETY KERNEL // ONLINE" | "The kernel is live." |
| 00:33 | Section 02 — Test Suite: **14/14 PASSED** | "All deterministic tests pass. Gas under 50k per call." |
| 00:38 | Section 05 — Deployed Contract (Polygon Amoy, chain 80002) | "CircuitBreaker is live on Polygon Amoy. 0-of-5 quorum enforced." |
| 00:44 | Section 08 — Five-node signer quorum | "Five nodes, three signatures required before any on-chain action." |
| 00:50 | Last Fetcher Run — result badge | "IPFS hash delivery verified across five gateways." |

*(No text-heavy tables — cursor is the primary guide.)*

**Captions:** Short one-liner per section, timed to highlight. Example at 00:33: `"CircuitBreaker.sol — O(1) check() < 50k gas."`

**Voice-over:**
> "The live dashboard shows the kernel status, all fourteen deterministic tests passing, the deployed contract on Polygon Amoy, the five-node quorum, and the fetcher run. Every field is reproducible."

---

## [00:55–01:10] Scene 4 — API Verify Endpoint

**Visual:** Terminal window, clean background. Cursor types once, output appears below — **held on screen for 8 s**:

```bash
curl -X POST https://proofbridge-liner.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'
```

```json
{ "kernel_version": "v0.9",
  "verdict": "SAFE",
  "belief": 0.759,
  "threshold": 0.514,
  "safety_margin": 0.245,
  "signature": "a3f2e…(HMAC-SHA256)" }
```

*(Formatted compactly — ~25 % fewer characters.)*

**Captions** appear inline:
> `POST /api/verify → μ=0.759  τ=0.514  margin=+0.245 → SAFE`

**Voice-over:**
> "The live verify endpoint runs the full Bayesian pipeline and returns posterior belief, calibrated threshold, safety margin, and a cryptographic signature. The verdict is deterministic."

---

## [01:10–01:28] Scene 5 — Product Outcome

**Visual:** Bold card, dark background. Holds for **8 s** *(this is the new explicit outcome statement)*:

> **OUTCOME**
> **Every AI output becomes a verifiable, adjudicatable legal statement.**
> Deterministic. Auditable. Timestamped.

On the left, a small three-property row:

| ✅ | Deterministic | Reproducible kernel output |
|---|---|---|
| ✅ | Auditable | Full reasoning chain logged |
| ✅ | Timestamped | HMAC-signed immutable proof |

**Captions:** Three words only, inline with card.
`Deterministic  ·  Auditable  ·  Timestamped`

**Voice-over:**
> "The concrete outcome of ProofBridge Liner is simple: every AI output becomes a provable, adjudicatable statement. No interpretation gaps, no 'the model said so'. A court, a regulator, or a buyer can verify it themselves."

---

## [01:28–01:42] Scene 6 — Close

**Visual:** Minimal title card:
> **ProofBridge Liner**
> *The truth layer for verifiable AI*
> Built by Divhani Majokweni

**(no links, no logos, no clutter — reduces text load.)*

**Captions:** ProofBridgeLiner.dev | Polygon Amoy Testnet
**Voice-over:**
> "ProofBridge Liner. Thank you."

---

## Production Notes

| Item | Detail |
|---|---|
| Voice recording | Audacity / OBS → export as overlay |
| Screen capture | OBS 1080p 30fps |
| Total duration | ~105 s |
| Diagram speed | Each architecture layer holds 8–10 s *(+60 % over v1)* |
| On-screen text | Reduced ~40%: replace text blocks with callout rows |
| Music | Ambient only — no vocals |
| Accessibility | Burn captions; upload to YouTube / LabLab |
| Output | `demo/pitch-demo-video.mp4`, ≤50 MB |
| State | Pheneom — localized video playback menu, 🗒️ exploring options for swift team . gitignore for any video editing temp files |
