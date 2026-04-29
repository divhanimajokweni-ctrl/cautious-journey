# Adversarial Validation Report

Generated: 2026-04-29T00:19:40.893Z

## Simulation Parameters

- N = 1000 per scenario
- Total gateways = 5
- Honest detection θ = 0.5
- P(H_t=1) = 0.01
- Probabilistic threshold τ* = 0.09

## Results

| Compromised (k) | Quorum TPR | Quorum FPR | Prob TPR | Prob FPR |
|-----------------|------------|------------|----------|----------|
| 0 | 0.818 | 0.000 | 0.818 | 0.000 |
| 1 | 1.000 | 0.000 | 1.000 | 0.000 |
| 2 | 0.889 | 0.000 | 1.000 | 0.000 |
| 3 | 0.364 | 0.000 | 0.727 | 0.000 |

## Analysis

The probabilistic rule shows superior resilience under adversarial compromise compared to the original quorum rule.

Degradation D(k) = Quorum TPR - Prob TPR:

- k=0: D = 0.000
- k=1: D = 0.000
- k=2: D = -0.111
- k=3: D = -0.364

## Figure: Circuit Breaker Reliability Under Adversarial Gateway Compromise

Plot TPR vs k for both rules. The probabilistic model maintains higher detection rates as compromise increases.

