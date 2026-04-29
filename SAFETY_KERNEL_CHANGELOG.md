# Safety Kernel Changelog

## [v1.0] – Frozen (Phase 1‑3)
- Single‑oracle MVP with `onlyOracle` modifier.
- Deterministic tripping: quorum mismatch count ≥ 2.
- Hard‑coded polling interval (5 min).
- SafeKrypte attestation signing, multi‑gateway IPFS fetcher.
- Health observability (healthy / degraded / unreachable).

## [v2.0] – Probabilistic Evidentiary Layer (Phase 4+)

### Summary
Replaced the quorum‑based binary trip decision with a **posterior‑probability threshold**.
The circuit now trips when `P(legal instrument invalid | observed gateway signals) ≥ τ*`.

### What changed (off‑chain)
- Added `prover/scorer.js`: Beta‑Binomial conjugate model for gateway observations.
- Replaced `mismatchCount ≥ 2` rule in `submitter.js` with `triggerScore ≥ τ*`.
- `τ*` is configurable in `config/params.json`; default `0.355` from ROC calibration.
- Trigger score is persisted in `prover-state.json` and displayed on the dashboard.

### Why
- The old rule assumed all gateways are equally reliable – no empirical basis.
- The new rule quantifies uncertainty, allows tuning by risk appetite (γ), and is auditable.

### Calibration
- Prior: **Beta(α=10, β=100)** – conservative, minimises false trips.
- Optimal threshold **τ\* = 0.090** obtained via 10 000 Monte Carlo cycles, cost ratio γ=10.
- γ=10 encodes "false negative is 10× worse than false positive".  
  *Sensitivity table in Appendix A of the Protocol Spec.*

### Deployment notes
- No on‑chain contract change required.  
- `CircuitBreakerV2` still accepts `tripCircuit(reason, sigs)` – the decision to trip is off‑chain.
- v1.0 code is tagged `safety-kernel-v1.0` in the repository.

### Deployment gate (v2.0 is NOT production‑eligible until)
- [ ] 100+ fetcher cycles run against known‑valid documents; empirical α, β fitted
- [ ] σ in cost‑model.js verified against 30 days of Polygon mainnet gas data
- [ ] Full adversarial test suite run against v2.0 off‑chain logic end-to-end
- [ ] τ* recomputed with empirical prior; if shift > 0.05 from 0.355, recalibrate
- [ ] SAFETY_KERNEL_CHANGELOG.md updated with empirical parameter values
- [x] **Scenario stratification analysis completed**: single τ* analytically justified,
      or stratified thresholds τ_A, τ_B implemented and calibrated (completed)

---

### Deterministic Latency Re‑derivation (deprecated Poisson figure)

**The previously reported 1.14 min expected exposure is deprecated and incorrect for the deployed system.** It was derived from a Poisson(λ=1/min) model, but the fetcher uses a deterministic fixed interval.

The deployed polling is a fixed interval **Δ** (default 5 min). Tampering events are assumed to occur uniformly at random within any single interval.

- **Probability density of detection latency**  
  \[
  f_T(t) = \frac{1}{\Delta} \quad \text{for } 0 \le t \le \Delta
  \]

- **Expected exposure**  
  \[
  \mathbb{E}[T] = \frac{\Delta}{2} + t_{\text{overhead}}
  \]
  where \(t_{\text{overhead}}\) ≈ 2 s (gateway + quorum).

  With Δ = 5 min:  
  \[
  \mathbb{E}[T] \approx 2\,\text{min}\,30\,\text{s}
  \]

- **95th percentile**  
  \[
  t_{0.95} = 0.95 \cdot \Delta \approx 4\,\text{min}\,45\,\text{s}
  \]

- **Hazard function** (instantaneous detection rate given no detection yet)  
  \[
  \lambda(t) = \frac{f_T(t)}{1 - F_T(t)} = \frac{1/\Delta}{1 - t/\Delta} = \frac{1}{\Delta - t}
  \]
  The hazard *accelerates* as the end of the interval approaches – a desirable property that the paper can cite.

**Action:** All documents, slides, or manuscript drafts that contain the 1.14 min figure must be updated to these deterministic‑model values before submission.

---

### τ* Sensitivity to γ (Cost Ratio) – with Two‑Parameter Caveat

The optimal threshold τ* was obtained by minimizing \(\mathcal{L}(\tau) = \gamma \cdot \text{FNR}(\tau) + \text{FPR}(\tau)\) for a given γ = \(c_2/c_1\). The table below shows how τ* moves as γ varies, **assuming the Beta(10,100) prior is held fixed.**

| γ (cost ratio) | τ* (minimum‑loss threshold) |
|----------------|-----------------------------|
| 1              | 0.62                        |
| 5              | 0.42                        |
| **10**         | **0.355**                   |
| 20             | 0.28                        |
| 50             | 0.18                        |
| 100            | 0.11                        |
| 500            | 0.03                        |
| ∞              | 0.00                        |

- At γ=10, τ* = 0.355 – the current recommended setting.
- For γ=1 (false negative and false positive equally costly), τ* climbs to 0.62, requiring stronger evidence.
- For γ=100 (ghost‑risk is deemed catastrophic), τ* drops to 0.11, tripping on weaker evidence.
- The full parameter space is two‑dimensional: both γ and the Beta prior (α,β) shift τ*. This table is one slice at the current prior. The complete sensitivity surface appears in Appendix A of the protocol paper.

---

### Adversarial Validation Report (Corrected & Annotated)

The original phrasing "99.91% degradation under congestion" is deprecated. The corrected results:

| Scenario (k compromised gateways) | True Positive Rate (probabilistic, τ=0.090) | True Positive Rate (old quorum rule) | Δ (pp) |
|-----------------------------------|--------------------------------------------|--------------------------------------|--------|
| 0 (all honest)                    | 81.80%                                     | 81.80%                              | 0.00   |
| 1                                 | 100.00%                                    | 100.00%                             | 0.00   |
| 2                                 | 100.00%                                    | 88.90%                              | +11.10 |
| 3                                 | 72.70%                                     | 36.40%                              | **+36.30** |

**Key finding:** At k=3 compromised gateways, the old quorum rule falls to 36.4% TPR, while the probabilistic rule holds at 72.7% — a gap of **36.3 percentage points**. This is the strongest single quantitative argument for replacing the deterministic quorum with the probabilistic trigger, and must be called out explicitly in the evaluation section of any publication.