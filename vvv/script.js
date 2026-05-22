const defaults = {
  alpha: 22,
  beta: 6,
  gamma: 1.4,
  threshold: 0.58,
  anomaly: false,
}

const state = { muted: false }
const ids = ['alpha', 'beta', 'gamma', 'threshold', 'anomaly']
const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]))
const out = {
  mu: document.getElementById('mu'),
  tau: document.getElementById('tau'),
  margin: document.getElementById('margin'),
  verdict: document.getElementById('verdict'),
  status: document.getElementById('kernelStatus'),
  heroVerdict: document.getElementById('heroVerdict'),
  heroReason: document.getElementById('heroReason'),
}

function betaMean(alpha, beta) {
  return (alpha + 1) / (alpha + beta + 2)
}

function calibratedThreshold(baseThreshold, gamma, alpha, beta) {
  if (alpha <= 0) return baseThreshold
  return baseThreshold / (1 + gamma * (beta / alpha))
}

function selectVoice(synth) {
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
  return voices.find((voice) => voice.lang === 'en-ZA')
    || voices.find((voice) => voice.lang === 'en-GB')
    || null
}

function speakUbuntu() {
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined' || state.muted) return
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance('Umuntu ngumuntu ngabantu')
  utterance.lang = 'en-ZA'
  const voice = selectVoice(synth)
  if (voice) utterance.voice = voice
  utterance.rate = 0.92
  synth.speak(utterance)
}

function cancelSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

function readKernel() {
  const alpha = Number(fields.alpha.value)
  const beta = Number(fields.beta.value)
  const gamma = Number(fields.gamma.value)
  const threshold = Number(fields.threshold.value)
  const anomaly = fields.anomaly.checked
  const mu = betaMean(alpha, beta)
  const tau = calibratedThreshold(threshold, gamma, alpha, beta)
  const margin = mu - tau
  const verdict = anomaly || alpha <= 0 ? 'HALT' : margin <= 0 ? 'HALT' : margin < 0.05 ? 'WARN' : 'PASS'
  return { mu, tau, margin, verdict, anomaly }
}

function render() {
  const kernel = readKernel()
  const halted = kernel.verdict === 'HALT'
  const warned = kernel.verdict === 'WARN'
  const reason = halted
    ? 'Umuntu ngumuntu ngabantu. Flow halted until the contribution anomaly is resolved.'
    : warned
      ? 'Safety margin is narrow. Proceed only with facilitator review.'
      : 'Safety margin is positive. Pool activity may proceed.'

  out.mu.textContent = kernel.mu.toFixed(3)
  out.tau.textContent = kernel.tau.toFixed(3)
  out.margin.textContent = kernel.margin.toFixed(3)
  out.verdict.textContent = kernel.verdict
  out.heroVerdict.textContent = kernel.verdict
  out.status.textContent = reason
  out.heroReason.textContent = reason
  document.body.classList.toggle('halted', halted)
  document.body.classList.toggle('warn', warned)

  if (halted && kernel.anomaly) speakUbuntu()
}

function resetKernel() {
  fields.alpha.value = defaults.alpha
  fields.beta.value = defaults.beta
  fields.gamma.value = defaults.gamma
  fields.threshold.value = defaults.threshold
  fields.anomaly.checked = defaults.anomaly
  cancelSpeech()
  render()
}

ids.forEach((id) => fields[id].addEventListener('input', render))
document.getElementById('haltBtn').addEventListener('click', () => {
  fields.anomaly.checked = true
  render()
})
document.getElementById('muteBtn').addEventListener('click', () => {
  state.muted = !state.muted
  cancelSpeech()
  document.getElementById('muteBtn').textContent = state.muted ? 'Unmute' : 'Mute'
})
document.getElementById('resetBtn').addEventListener('click', resetKernel)

render()
