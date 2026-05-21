import jwt from '../../lib/jwt.js'

/**
 * GET /api/auth/session
 * Returns the current session from the Bearer token header.
 * Unauthenticated callers receive 401.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET'] })

  const header = req.headers.authorization || req.headers.Authorization || ''
  const token  = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.cookies?.session || req.query.token

  if (!token)
    return res.status(401).json({ error: 'MISSING_SESSION', hint: 'Send Bearer token or session cookie' })

  let payload
  try { payload = jwt.verify(token) } catch (_) {
    return res.status(401).json({ error: 'INVALID_SESSION' })
  }

  return res.status(200).json({ ok: true, session: { address: payload.address, issuedAt: payload.issuedAt, exp: payload.exp } })
}
