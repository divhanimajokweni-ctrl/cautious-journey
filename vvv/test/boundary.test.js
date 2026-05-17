// Boundary & edge-case tests for ProofBridge Bayesian kernel
// Pure unit tests — no server required.
// Run: npx jest test/boundary.test.js

const { infer, betaMean, calibratedThreshold, computeVerdict } = require('../lib/kernel.js')

describe('Bayesian Kernel — Boundary Conditions', () => {
  describe('Posterior belief extremes', () => {
    test('α → 0, β large → belief → 0', () => {
      const out = infer({ alpha: 0.001, beta: 1000, gamma: 1, threshold: 0.5 })
      expect(out.belief).toBeLessThan(0.01)
      expect(out.verdict).toBe('TRIP')
    })

    test('β → 0, α large → belief → 1', () => {
      const out = infer({ alpha: 1000, beta: 0.001, gamma: 1, threshold: 0.5 })
      expect(out.belief).toBeGreaterThan(0.99)
      expect(out.verdict).toBe('SAFE')
    })

    test('α=β=0 (uniform prior only) → belief=0.5', () => {
      const out = infer({ alpha: 0, beta: 0, gamma: 1, threshold: 0.5 })
      expect(out.belief).toBeCloseTo(0.5, 5)
    })
  })

  describe('Gamma calibration edge cases', () => {
    test('γ = 0 (neutral) → threshold unchanged', () => {
      const base_t = 0.6
      const out = infer({ alpha: 10, beta: 10, gamma: 0, threshold: base_t })
      expect(out.threshold).toBeCloseTo(base_t, 5)
    })

    test('High γ + high β/α → threshold collapses toward 0', () => {
      const out = infer({ alpha: 5, beta: 20, gamma: 2.0, threshold: 0.5 })
      expect(out.threshold).toBeLessThan(0.1)
    })

    test('γ < 1 → threshold increases vs γ=1', () => {
      const neutral = infer({ alpha: 10, beta: 10, gamma: 1, threshold: 0.6 })
      const lenient = infer({ alpha: 10, beta: 10, gamma: 0.8, threshold: 0.6 })
      expect(lenient.threshold).toBeGreaterThan(neutral.threshold)
    })

    test('γ > 1 → threshold decreases', () => {
      const neutral = infer({ alpha: 10, beta: 10, gamma: 1, threshold: 0.6 })
      const sensitive = infer({ alpha: 10, beta: 10, gamma: 1.5, threshold: 0.6 })
      expect(sensitive.threshold).toBeLessThan(neutral.threshold)
    })
  })

  describe('Safety margin computation', () => {
    test('margin positive → SAFE, negative → TRIP', () => {
      const safe = infer({ alpha: 20, beta: 5, gamma: 1, threshold: 0.5 })
      expect(safe.safety_margin).toBeGreaterThan(0)
      expect(safe.verdict).toBe('SAFE')

      const trip = infer({ alpha: 5, beta: 20, gamma: 1, threshold: 0.5 })
      expect(trip.safety_margin).toBeLessThan(0)
      expect(trip.verdict).toBe('TRIP')
    })
  })

  describe('Reasoning chain determinism', () => {
    test('identical inputs produce identical reasoning chains', () => {
      const payload = { alpha: 12, beta: 8, gamma: 1.2, threshold: 0.6 }
      const r1 = infer(payload)
      const r2 = infer(payload)
      expect(r1.reasoning_chain).toEqual(r2.reasoning_chain)
    })

    test('reasoning chain has required fields', () => {
      const out = infer({ alpha: 10, beta: 10, gamma: 1, threshold: 0.6 })
      const chain = out.reasoning_chain
      expect(Array.isArray(chain)).toBe(true)
      expect(chain.length).toBe(3)
      for (const step of chain) {
        expect(step).toHaveProperty('step_id')
        expect(step).toHaveProperty('timestamp')
        expect(step).toHaveProperty('input_hash')
        expect(step).toHaveProperty('computed_value')
      }
    })
  })
})