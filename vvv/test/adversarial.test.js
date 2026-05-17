// Adversarial stability tests — Monte Carlo perturbation
// Run: npx jest test/adversarial.test.js

const { infer } = require('../lib/kernel.js')

describe('Adversarial Perturbation Stability', () => {
  function perturb(value, epsilon = 0.05) {
    const direction = Math.random() < 0.5 ? 1 : -1
    return Math.max(0, value + direction * epsilon * value)
  }

  test('small perturbations around stable decision do not flip verdict', () => {
    const base = { alpha: 50, beta: 10, gamma: 1.0, threshold: 0.6 }
    const runs = 20
    const verdicts = []

    for (let i = 0; i < runs; i++) {
      const p = {
        alpha: perturb(base.alpha, 0.1),
        beta: perturb(base.beta, 0.1),
        gamma: perturb(base.gamma, 0.1),
        threshold: perturb(base.threshold, 0.05)
      }
      const out = infer(p)
      verdicts.push(out.verdict)
    }

    const unique = new Set(verdicts)
    expect(unique.size).toBe(1)
    expect(verdicts[0]).toBe('SAFE')
  })

  test('reasoning chain input_hash changes with any input change', () => {
    const base = { alpha: 10, beta: 10, gamma: 1, threshold: 0.6 }
    const r1 = infer(base)
    const r2 = infer({ ...base, alpha: 11 })
    expect(r1.reasoning_chain[0].input_hash).not.toEqual(r2.reasoning_chain[0].input_hash)
  })

  test('safety margin sign matches verdict', () => {
    const out = infer({ alpha: 10, beta: 10, gamma: 1, threshold: 0.6 })
    if (out.safety_margin > 0) {
      expect(out.verdict).toBe('SAFE')
    } else {
      expect(out.verdict).toBe('TRIP')
    }
  })
})