import { createHmac, timingSafeEqual } from 'node:crypto'

const PREFIX = 'pb_up_group_'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readToken(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  return body.poolToken || body.token || ''
}

export function verifyPoolToken(poolToken, now = Date.now()) {
  const secret = process.env.POOL_TOKEN_SECRET
  if (!secret) return { ok: false, error: 'missing_pool_token_secret' }
  if (!poolToken.startsWith(PREFIX)) return { ok: false, error: 'invalid_prefix' }

  const token = poolToken.slice(PREFIX.length)
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return { ok: false, error: 'malformed_token' }

  const expected = sign(payload, secret)
  if (!safeEqual(expected, signature)) return { ok: false, error: 'invalid_signature' }

  let claims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'invalid_payload' }
  }

  if (claims.aud !== 'vvu-secure-console') return { ok: false, error: 'invalid_audience' }
  if (!claims.group || typeof claims.group !== 'string') return { ok: false, error: 'missing_group' }
  if (!Number.isFinite(claims.exp) || claims.exp <= now) return { ok: false, error: 'expired_token' }

  return { ok: true, group: claims.group, issuedAt: claims.iat, expiresAt: claims.exp }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed', allowed: ['POST'] })

  let poolToken
  try {
    poolToken = readToken(req)
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }

  const result = verifyPoolToken(String(poolToken || ''))
  return res.status(result.ok ? 200 : 403).json(result)
}

export { base64url, sign, PREFIX }
