# Stochastic Economic Model for ProofBridge Liner

Generated: 2026-04-28T23:09:39.195Z

## Model Parameters

- Gas price: Lognormal(μ=-8.52, σ=0.5)
- c_u = 100000 gas units (updateProof)
- c_t = 50000 gas units (tripCircuit)
- λ_u = 1 (expected updates/month)
- λ_t = 10 * FPR = 0.10
- FPR = 0.01
- c_fixed = $5/month

## Monte Carlo Results (N=10000)

- Mean monthly cost: $29.072
- Median monthly cost: $22.317
- 95% CI: [$5.000, $105.312]

## Conclusion

Under current Polygon gas conditions and conservative trip rate, the monthly operational cost per attested asset is **$29.072 [5.000, 105.312]** with 95% confidence.

