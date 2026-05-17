// ProofBridge Liner — Bayesian Safety Kernel
// Vercel serverless function: /api/verify
// Beta-Binomial posterior + industry-calibrated threshold + deterministic audit trail

const { hmacsha256 } = require('../lib/kernel.js')

const KERNEL_VERSION = 'v0.9'
const BASE_THRESHOLD = 0.6

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { alpha, beta, gamma, threshold: base_threshold } = req.body
  const a = Number(alpha)
  const b = Number(beta)
  const g = Number(gamma)
  const t = Number(base_threshold) || BASE_THRESHOLD

  if (![a, b, g, t].every(Number.isFinite) || a < 0 || b < 0 || g <= 0 || t < 0 || t > 1) {
    return res.status(400).json({
      error: 'Invalid parameters',
      expected: { alpha: '≥0', beta: '≥0', gamma: '>0', threshold: '0–1' }
    })
  }

  const { infer } = require('../lib/kernel.js')
  let result
  try {
    result = infer({ alpha: a, beta: b, gamma: g, threshold: t })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  const secret = process.env.KERNEL_SECRET || 'dev-secret'
  const signature = hmacsha256(`${result.belief}:${result.threshold}:${result.verdict}`, secret)

  res.status(200).json({
    kernel_version: KERNEL_VERSION,
    verdict: result.verdict,
    belief: result.belief,
    threshold: result.threshold,
    safety_margin: result.safety_margin,
    reasoning_chain: result.reasoning_chain,
    signature,
    metadata: {
      alpha: a,
      beta: b,
      gamma: g,
      base_threshold: t,
      timestamp: new Date().toISOString()
    }
  })
}