import { createHmac, timingSafeEqual } from 'node:crypto'

export const config = {
  api: {
    bodyParser: false,
  },
}

const ACCEPTED_EVENT_TYPES = new Set([
  'payment_initiation_request.completed',
  'payment_initiation_request.cancelled',
  'payment_initiation_request.expired',
  'payment_initiation_request.pending',
  'payment.completed',
  'payment.cancelled',
  'payment.expired',
  'payment.pending',
])

async function readRawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return Buffer.from(req.rawBody)
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return Buffer.from(req.body)

  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function header(req, name) {
  const value = req.headers[name] || req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function normalizeSecret(secret) {
  return secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : secret
}

function webhookSecrets() {
  return [process.env.STITCH_WEBHOOK_SECRET, process.env.STITCH_ENDPOINT_SIGNING_SECRET]
    .filter(Boolean)
}

function verifySignature(req, rawBody) {
  const secrets = webhookSecrets()
  if (secrets.length === 0) return { ok: false, error: 'missing_webhook_secret' }

  const directSignature = header(req, 'stitch-signature')
    || header(req, 'x-stitch-signature')
    || header(req, 'x-webhook-signature')

  if (directSignature) {
    const normalized = String(directSignature).replace(/^sha256=/, '')
    for (const secret of secrets) {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
      if (safeEqual(expected, normalized)) return { ok: true }
    }
  }

  const svixId = header(req, 'svix-id')
  const svixTimestamp = header(req, 'svix-timestamp')
  const svixSignature = header(req, 'svix-signature')
  if (svixId && svixTimestamp && svixSignature) {
    const timestampMs = Number(svixTimestamp) * 1000
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return { ok: false, error: 'stale_signature' }
    }

    const signedContent = Buffer.concat([
      Buffer.from(`${svixId}.${svixTimestamp}.`),
      rawBody,
    ])
    const signatures = String(svixSignature).split(' ').flatMap((entry) => entry.split(',')).map((entry) => entry.replace(/^v\d+=/, ''))
    for (const secret of secrets) {
      const expected = createHmac('sha256', normalizeSecret(secret)).update(signedContent).digest('base64')
      if (signatures.some((signature) => safeEqual(expected, signature))) return { ok: true }
    }
  }

  return { ok: false, error: directSignature || svixSignature ? 'invalid_signature' : 'missing_signature' }
}

function extractPayment(event) {
  const payment = event.payment || event.data || event
  return {
    type: event.type || event.eventType || payment.type || 'unknown',
    id: event.id || payment.id || payment.paymentRequestId || null,
    status: payment.status || payment.state?.__typename || payment.state || event.type || 'unknown',
    reference: payment.clientReference || payment.payerReference || payment.beneficiaryReference || payment.reference || payment.id || null,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed', allowed: ['POST'] })
  }

  const rawBody = await readRawBody(req)
  const verification = verifySignature(req, rawBody)
  if (!verification.ok) return res.status(401).json({ ok: false, error: verification.error })

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8') || '{}')
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }

  const payment = extractPayment(event)
  const accepted = ACCEPTED_EVENT_TYPES.has(payment.type) || payment.type.startsWith('payment')
  if (!accepted) {
    return res.status(202).json({ ok: true, rail: 'stitch', received: true, ignored: true, eventType: payment.type })
  }

  return res.status(200).json({
    ok: true,
    rail: 'stitch',
    received: true,
    eventType: payment.type,
    paymentId: payment.id,
    status: payment.status,
    reference: payment.reference,
    idempotencyKey: payment.id || payment.reference,
  })
}
