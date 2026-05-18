/** vvv/ProofBridgeGate1.jsx — Gate-1 Terminal UI entry point
 *  Served at /gate-1 by vercel.json route
 *  Mounts into the .gate-root div in vvv/gate-1.html via a <script> shim.
 *  This file is a standalone ESM shim — it only touches the DOM inside #gate-root
 *  (or the existing .gate-hero-inner div in ALL_CAPS); no bundler required.
 */
import { createElement as h } from 'react'
import { useState, useEffect, useCallback } from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

const CHAINS = ['AMOY', 'FABRIC']

function isHex64(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s)
}
function isHexNonce(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s)
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function postVerify(body) {
  const r = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

// ── Status badge ──────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }) {
  const map = { PASS: 'pass', WARN: 'warn', HALT: 'halt' }
  const cls = map[verdict] || ''
  return h('span', { className: `vbadge ${cls}`, 'data-v': verdict }, verdict)
}

// ── receipt card ──────────────────────────────────────────────────────────────

function ReceiptCard({ r }) {
  const rows = [
    ['receipt_id', r.receipt_id],
    ['deed_hash',  r.deed_hash],
    ['pipeline_hash', r.pipeline_hash],
    ['anchored_at', r.anchored_at ?? 'null'],
    ['signature',  r.signature],
  ]
  return h('div', { className: 'rcard' },
    h('div', { className: 'rheader' },
      h('span', { className: 'dot green' }), ' Gate-1 Receipt'
    ),
    h('div', { className: 'rrows' }, rows.map(([k, v]) =>
      h('div', { className: 'rrow', key: k },
        h('span', { className: 'rk', title: k }, k),
        h('code',  { className: 'rv', title: v }, v)
      )
    ))
  )
}

// ── signal card ───────────────────────────────────────────────────────────────

function SignalCard({ s }) {
  return h('div', { className: 'scard' },
    h('div', { className: 'rheader' },
      h('span', { className: 'dot amber' }), ' SafeGrid Signal'
    ),
    h('div', { className: 'rrows' },
      ['evaluator_version', 'signal_id'].map(k =>
        h('div', { className: 'rrow', key: k },
          h('span', { className: 'rk' }, k),
          h('code',  { className: 'rv' }, s[k] ?? '—')
        )
      )
    )
  )
}

// ── main component ────────────────────────────────────────────────────────────

function App() {
  const [form, setForm]           = useState({
    alpha: '2', beta: '1', gamma: '1.2',
    threshold: '0.6',
    deed_hash:      '',
    issuer_did:     'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    property_ref:   '',
    chain_target:   'AMOY',
  })
  const [loading, setLoading]     = useState(false)
  const [receipt, setReceipt]     = useState(null)
  const [error, setError]         = useState(null)
  const [anonUrl, setAnonUrl]     = useState(null)

  const onChange = useCallback((e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'chain_target') setError(null)
  }, [])

  const onSubmit = useCallback(async (e) => {
    e.preventDefault(); setError(null); setReceipt(null); setAnonUrl(null)
    if (!isHex64(form.deed_hash)) {
      setError('deed_hash must be exactly 64 lowercase hex characters (SHA-256).')
      return
    }
    const chain = form.chain_target.toUpperCase()
    if (!CHAINS.includes(chain)) {
      setError(`chain_target "${chain}" is not a permitted network. Permitted: ${CHAINS.join(', ')}.`)
      return
    }
    setLoading(true)
    try {
      const body = {
        ...form,
        chain_target: chain,
        alpha: +form.alpha, beta: +form.beta,
        gamma: +form.gamma, threshold: +form.threshold,
      }
      const r = await postVerify(body)
      if (r.ok) {
        setReceipt(r)
        setAnonUrl(
          `https://proofbridge-liner.vercel.app/api/verify` +
          `#r=${encodeURIComponent(JSON.stringify({ok:true,receipt_id:r.receipt_id,verdict:r.verdict,anchored_at:null,signature:r.signature}))}`
        )
      } else {
        setError(r.error + (r.errors?.length ? ': ' + r.errors.join(' ') : ''))
      }
    } catch (ex) { setError(ex.message) }
    finally { setLoading(false) }
  }, [form])

  const onMintTest = useCallback(async () => {
    setError(null); setReceipt(null)
    if (!isHex64(form.deed_hash) || !isHexNonce(form.deed_hash.slice(0, 64))) {
      setError('deed_hash must be 64 hex chars (SHA-256).')
      return
    }
    const nonce = 'a'.repeat(64) // test nonce
    setLoading(true)
    try {
      const r = await postVerify({ ...form, chain_target: form.chain_target.toUpperCase(), alpha: +form.alpha, beta: +form.beta, gamma: +form.gamma, threshold: +form.threshold })
      setReceipt(r)
    } catch (ex) { setError(ex.message) }
    finally { setLoading(false) }
  }, [form])

  // ── render ─────────────────────────────────────────────────────────────────

  return h('div', { className: 'gate-app' },
    h('section', { className: 'gform' },
      h('form', { onSubmit, autoComplete: 'off' },
        h('fieldset', {},
          h('legend', {}, 'Parameters'),
          h('div', { className: 'fgrid' },
            ['alpha','beta','gamma','threshold'].map(name =>
              h('div', { className: 'fitem', key: name },
                h('label', { htmlFor: name }, name),
                h('input', {
                  id: name, name, type: 'number', step: 'any',
                  value: form[name],
                  onChange,
                  disabled: loading,
                })
              )
            )
          )
        ),
        h('fieldset', {},
          h('legend', {}, 'Identity'),
          ['deed_hash','issuer_did','property_ref'].map(name =>
            h('div', { className: 'fitem', key: name },
              h('label', { htmlFor: name }, name),
              h('input', {
                id: name, name, type: 'text',
                value: form[name] || '',
                onChange,
                disabled: name === 'issuer_did' && form.issuer_did,
                placeholder: name === 'deed_hash' ? '64-char SHA-256 (hex)' : '',
              }),
              name === 'deed_hash' && h('small', { key: 'dh-hint' },
                isHex64(form.deed_hash)
                  ? h('span', { className: 'ok' }, '✓ valid SHA-256')
                  : h('span', { className: 'err' }, '✗ must be 64 hex chars')
              )
            )
          ),
          h('div', { className: 'fitem' },
            h('label', { htmlFor: 'chain_target' }, 'chain_target'),
            h('select', {
              id: 'chain_target', name: 'chain_target',
              value: form.chain_target,
              onChange,
              disabled: loading,
            },
              CHAINS.map(c => h('option', { key: c, value: c }, c))
            )
          )
        ),
        h('div', { className: 'factions' },
          h('button', { type: 'submit', disabled: loading, className: 'btn-primary' },
            loading ? 'Computing…' : 'Post to /api/verify'
          ),
          h('button', {
            type: 'button',
            onClick: onMintTest,
            disabled: loading,
            className: 'btn-secondary',
            title: 'Dev shortcut — sends current form to /api/verify',
          },
            'Dev: send to verify'
          )
        )
      )
    ),

    error && h('div',    { className: 'msg err' }, error),
    receipt && h('div',  { className: 'receipt' },
      h(ReceiptCard, { r: receipt }),
      h(SignalCard,  { s: receipt.safegrid_signal }),
      anonUrl && h('div', { className: 'anon-url' },
        'Anchored receipt link: ',
        h('a', { href: anonUrl, target: '_blank', rel: 'noopener' }, anonUrl)
      )
    )
  )
}

// ── mount ────────────────────────────────────────────────────────────────────

const target = document.querySelector('.gate-hero-inner')
if (target) {
  const root = document.createElement('div')
  target.appendChild(root)
  // eslint-disable-next-line no-undef
  if (typeof ReactDOM !== 'undefined') {
    ReactDOM.render(h(App), root)
  } else {
    root.innerHTML = `<div id="gate-app-placeholder"><p>React not loaded inline — use /gate-1 (vanilla) or upgrade to include ReactDOM.</p></div>`
  }
}
