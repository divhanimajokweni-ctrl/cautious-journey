import { base64url, sign, PREFIX } from './verify.js'

function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed', allowed: ['POST'] })

  const secret = process.env.POOL_TOKEN_SECRET
  const adminSecret = process.env.POOL_TOKEN_ADMIN_SECRET
  if (!secret) return res.status(503).json({ ok: false, error: 'missing_pool_token_secret' })
  if (!adminSecret) return res.status(503).json({ ok: false, error: 'missing_pool_token_admin_secret' })
  if (req.headers['x-pool-admin-secret'] !== adminSecret) return res.status(401).json({ ok: false, error: 'unauthorized_minter' })

  let body
  try {
    body = readBody(req)
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }

  const group = String(body.group || '').trim()
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(group)) return res.status(400).json({ ok: false, error: 'invalid_group' })

  const ttlSeconds = Math.min(Math.max(Number(body.ttlSeconds || 3600), 60), 604800)
  const now = Date.now()
  const claims = {
    aud: 'vvu-secure-console',
    group,
    iat: now,
    exp: now + ttlSeconds * 1000,
  }
  const payload = base64url(JSON.stringify(claims))
  const poolToken = `${PREFIX}${payload}.${sign(payload, secret)}`

  return res.status(200).json({ ok: true, poolToken, expiresAt: claims.exp, path: `/dashboard?poolToken=${poolToken}` })
}
