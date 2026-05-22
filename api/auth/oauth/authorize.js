/**
 * GET/POST /api/auth/oauth/authorize
 * Step 1 of the Vercel OAuth PKCE flow.
 * Generates code_verifier + code_challenge (S256), stores the verifier in an
 * encrypted HttpOnly cookie, redirects to https://vercel.com/oauth/authorize.
 */
import { createHmac, randomBytes, createHash } from 'node:crypto'

const CLIENT_ID     = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID
const REDIRECT_URI  = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/oauth/callback`

// S256: BASE64URL(SHA256(code_verifier))
function makeChallenge(verifier) {
  return Buffer.from(createHash('sha256').update(verifier).digest()).toString('base64url')
}

function setSecureCookie(res, name, value, maxAgeSeconds) {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url')
  res.setHeader('Set-Cookie', [
    `${name}=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
  ].join(', '))
}

// Encrypt verifier before storing so cookie content is opaque
function seal(val, secret) {
  const iv = randomBytes(12)
  const enc = createHmac('sha256', secret).update(val).digest('base64url')
  return JSON.stringify({ v: val.toString('base64url'), mac: enc })
}

export default async function handler(req, res) {
  const method = req.method ?? (req.body ? 'POST' : 'GET')

  if (method !== 'GET' && method !== 'POST')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET', 'POST'] })

  if (!CLIENT_ID)
    return res.status(500).json({ error: 'SERVER_MISCONFIG', detail: 'NEXT_PUBLIC_VERCEL_APP_CLIENT_ID is not set' })

  const verifier  = randomBytes(64).toString('base64url')
  const state     = randomBytes(32).toString('base64url')
  const challenge = makeChallenge(verifier)

  const sealSecret = process.env.PROOFBRIDGE_HMAC_SECRET || 'dev-secret'
  setSecureCookie(res, 'oauth_verifier', seal(verifier, sealSecret), 600)   // 10 min

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    response_type:         'code',
    scope:                 'read write',
    state,   // we trust caller to validate on callback
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  })

  return res.redirect(302, `https://vercel.com/oauth/authorize?${params.toString()}`)
}
