// ProofBridge Bayesian Kernel — pure functions for unit testing
// CommonJS module

function betaMean(alpha, beta) {
  return (alpha + 1) / (alpha + beta + 2)
}

function calibratedThreshold(baseThreshold, gamma, alpha, beta) {
  if (alpha <= 0) return 0
  const ratio = beta / alpha
  return baseThreshold / (1 + gamma * ratio)
}

function computeVerdict(belief, threshold) {
  const safetyMargin = belief - threshold
  return {
    verdict: safetyMargin > 0 ? 'SAFE' : 'TRIP',
    safety_margin: safetyMargin
  }
}

const { createHash, createHmac } = require('crypto')

function sha256(str) {
  return createHash('sha256').update(str).digest('hex')
}

function hmacsha256(str, secret) {
  return createHmac('sha256', secret).update(str).digest('hex')
}

function buildReasoningChain(alpha, beta, gamma, baseThreshold, belief, calibratedThreshold, verdict, margin) {
  const ts = Date.now()
  return [
    {
      step_id: 'posterior_compute',
      timestamp: ts,
      input_hash: sha256(`alpha:${alpha}:beta:${beta}`),
      computed_value: Number(belief.toFixed(6))
    },
    {
      step_id: 'threshold_calibrate',
      timestamp: ts + 1,
      input_hash: sha256(`threshold:${baseThreshold}:gamma:${gamma}:ratio:${(beta/alpha).toFixed(6)}`),
      computed_value: Number(calibratedThreshold.toFixed(6))
    },
    {
      step_id: 'decision_compare',
      timestamp: ts + 2,
      input_hash: sha256(`belief:${belief.toFixed(6)}:threshold:${calibratedThreshold.toFixed(6)}`),
      computed_value: `${verdict} (margin=${margin.toFixed(6)})`
    }
  ]
}

function infer({ alpha, beta, gamma, threshold: baseThreshold }) {
  const a = Number(alpha)
  const b = Number(beta)
  const g = Number(gamma)
  const t = Number(baseThreshold)

  if (![a, b, g, t].every(Number.isFinite) || a < 0 || b < 0 || g <= 0 || t < 0 || t > 1) {
    throw new Error('Invalid parameters')
  }

  const belief = betaMean(a, b)
  const calibrated_threshold = calibratedThreshold(t, g, a, b)
  const { verdict, safety_margin } = computeVerdict(belief, calibrated_threshold)
  const reasoning_chain = buildReasoningChain(a, b, g, t, belief, calibrated_threshold, verdict, safety_margin)

  return {
    verdict,
    belief: Number(belief.toFixed(6)),
    threshold: Number(calibrated_threshold.toFixed(6)),
    safety_margin: Number(safety_margin.toFixed(6)),
    reasoning_chain
  }
}

module.exports = {
  betaMean,
  calibratedThreshold,
  computeVerdict,
  sha256,
  hmacsha256,
  buildReasoningChain,
  infer
}