const PB_ANT = ' \\ _ /\n  (o)\n  / \\ '
const TOKEN_ENDPOINT = '/api/pool-token/verify'
const SVIX_PORTAL_ENDPOINT = '/api/svix/app-portal'

const dashboard = {
  alpha: 5,
  beta: 1,
  tau: 0.64,
  failures: 0,
  muted: false,
  poolToken: null,
}

const gateLoading = document.getElementById('gateLoading')
const gateDenied = document.getElementById('gateDenied')
const secureConsole = document.getElementById('secureConsole')
const logList = document.getElementById('mutationLog')

function $(id) {
  return document.getElementById(id)
}

function betaMean(alpha, beta) {
  return (alpha + 1) / (alpha + beta + 2)
}

function formatSigned(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`
}

function selectVoice(synth) {
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
  return voices.find((voice) => voice.lang === 'en-ZA') || voices.find((voice) => voice.lang === 'en-GB') || null
}

function speak(message) {
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined' || dashboard.muted) return
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(message)
  utterance.lang = 'en-ZA'
  utterance.rate = 0.9
  const voice = selectVoice(synth)
  if (voice) utterance.voice = voice
  synth.speak(utterance)
}

function renderKernel(forcedVerdict) {
  const mu = betaMean(dashboard.alpha, dashboard.beta)
  const margin = mu - dashboard.tau
  const verdict = forcedVerdict || (dashboard.alpha <= 0 || margin <= 0 ? 'HALT' : margin < 0.05 ? 'WATCH' : 'SAFE')

  $('dashMu').textContent = mu.toFixed(4)
  $('dashTau').textContent = dashboard.tau.toFixed(4)
  $('dashMargin').textContent = formatSigned(margin)
  $('dashVerdict').textContent = verdict
  document.body.dataset.state = verdict.toLowerCase()
  return { mu, margin, verdict }
}

function addLog(verdict, message) {
  const line = document.createElement('div')
  line.textContent = `[${new Date().toLocaleTimeString()}] [${verdict}] ${message}`
  logList.prepend(line)
}

function mutate(type) {
  const fault = type === 'FRAUD' || type === 'FORGE'
  dashboard.alpha += fault ? 0 : 2
  dashboard.beta += fault ? 4 : 0
  dashboard.failures = fault ? dashboard.failures + 1 : 0

  const kernel = renderKernel(fault ? 'HALT' : undefined)
  const loopAbort = dashboard.failures >= 3
  const message = loopAbort
    ? 'Mental circuit breaker tripped after repeated failed mutations. Umuntu ngumuntu ngabantu.'
    : fault
      ? `CIRCUIT BREAKER TRIPPED: ${type} detected. Safety Margin S equals ${kernel.margin.toFixed(4)}.`
      : 'MUTATION CLEARED: State settled to Polygon Amoy.'

  $('assetState').textContent = fault ? 'BREACH_ISOLATED' : 'ANCHORED'
  $('assetCard').classList.toggle('breach', fault)
  $('dashStatus').textContent = message
  addLog(fault ? 'HALT' : kernel.verdict, message)
  speak(fault ? `${message} Umuntu ngumuntu ngabantu.` : 'State cleared and anchored.')
}

function resetConsole() {
  dashboard.alpha = 5
  dashboard.beta = 1
  dashboard.failures = 0
  $('assetState').textContent = 'CLEAR'
  $('assetCard').classList.remove('breach')
  $('dashStatus').textContent = 'Authorized secure console ready.'
  logList.textContent = ''
  renderKernel()
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

function showDenied() {
  gateLoading.hidden = true
  gateDenied.hidden = false
  secureConsole.hidden = true
  document.body.dataset.gate = 'denied'
}

function showConsole(group) {
  gateLoading.hidden = true
  gateDenied.hidden = true
  secureConsole.hidden = false
  document.body.dataset.gate = 'authorized'
  $('groupName').textContent = group || 'verified'
  renderKernel()
}

async function verifyGate() {
  const poolToken = new URLSearchParams(window.location.search).get('poolToken')
  if (!poolToken) return showDenied()
  dashboard.poolToken = poolToken

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ poolToken }),
    })
    const result = await response.json()
    if (!response.ok || !result.ok) return showDenied()
    showConsole(result.group)
  } catch {
    showDenied()
  }
}

async function openSvixPortal() {
  if (!dashboard.poolToken) return showDenied()
  $('dashStatus').textContent = 'Requesting short-lived Svix App Portal session...'

  try {
    const response = await fetch(SVIX_PORTAL_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ poolToken: dashboard.poolToken, next: '/endpoints' }),
    })
    const result = await response.json()
    if (!response.ok || !result.ok || !result.url) {
      $('dashStatus').textContent = result.error || 'Unable to create Svix App Portal session.'
      return
    }

    $('svixPortalFrame').src = result.url
    $('svixPortalFrameWrap').hidden = false
    $('dashStatus').textContent = 'Svix App Portal session loaded for endpoint inspection and replay.'
  } catch {
    $('dashStatus').textContent = 'Unable to reach Svix App Portal endpoint.'
  }
}

$('settleBtn').addEventListener('click', () => mutate('CLEAR'))
$('fraudBtn').addEventListener('click', () => mutate('FRAUD'))
$('forgeBtn').addEventListener('click', () => mutate('FORGE'))
$('svixPortalBtn').addEventListener('click', openSvixPortal)
$('dashResetBtn').addEventListener('click', resetConsole)
$('dashMuteBtn').addEventListener('click', () => {
  dashboard.muted = !dashboard.muted
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  $('dashMuteBtn').setAttribute('aria-pressed', String(dashboard.muted))
  $('dashMuteBtn').textContent = dashboard.muted ? 'Voice alerts off' : 'Voice alerts on'
})

if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
  window.speechSynthesis.addEventListener('voiceschanged', () => {})
}

verifyGate()
