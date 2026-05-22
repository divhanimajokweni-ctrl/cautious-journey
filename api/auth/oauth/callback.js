/**
 * GET /api/auth/oauth/callback
 * Step 2: Vercel redirects back with ?code=…&state=…
 * Exchanges code for access_token + refresh_token (token endpoint),
 * then issues its own session JWT.
 */
import { createHmac, randomBytes } from 'node:crypto'
import jwt from '../jwt.js'

const CLIENT_ID     = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID
const CLIENT_SECRET = process.env.VERCEL_APP_CLIENT_SECRET
const TOKEN_URL     = 'https://vercel.com/oauth/token'

function getCookieValue(req, name) {
  const raw = req.cookies?.[name]
  if (!raw) return null
  try { return JSON.parse(Buffer.from(raw, 'base64url').toString()) } catch (_) { return null }
}

function setCookie(res, name, value, maxAgeSeconds) {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url')
  res.setHeader('Set-Cookie', `${name}=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`)
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/oauth/callback`,
    code_verifier: verifier,
  })

  const r = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`Token exchange failed (${r.status}): ${detail}`)
  }
  return r.json()
}

export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET'] })

  if (!CLIENT_ID || !CLIENT_SECRET)
    return res.status(500).json({ error: 'SERVER_MISCONFIG', detail: 'OAuth env vars missing' })

  const url  = new URL(req.url, `https://${req.headers.host}`)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state)
    return res.status(400).json({ error: 'MISSING_CODE_OR_STATE', detail: url.searchParams.toString() })

  const sealed = getCookieValue(req, 'oauth_verifier')
  if (!sealed)
    return res.status(400).json({ error: 'MISSING_VERIFIER', hint: 'PKCE cookie not found — restart the flow' })

  let verifier
  try {
    const { v } = JSON.parse(Buffer.from(sealed, 'base64url').toString())
    verifier = Buffer.from(v, 'base64url').toString()
  } catch (_) {
    return res.status(400).json({ error: 'INVALID_COOKIE' })
  }

  clearCookie(res, 'oauth_verifier')

  let tokenData
  try {
    tokenData = await exchangeCode(code, verifier)
  } catch (err) {
    return res.status(502).json({ error: 'TOKEN_EXCHANGE_FAILED', detail: err.message })
  }

  const { access_token, refresh_token, expires_in } = tokenData

  // Store OAuth tokens as HttpOnly cookies
  setCookie(res, 'access_token',  { token: access_token,  exp: Date.now() / 1000 + (expires_in || 3600) }, expires_in || 3600)
  setCookie(res, 'refresh_token', { token: refresh_token,  exp: Date.now() / 1000 + 86400 * 30 },                           86400 * 30)

  // Issue a local session JWT so downstream API routes don't need to parse OAuth tokens
  const sessionToken = jwt.sign({
    provider:   'vercel',
    issuedAt:   Math.floor(Date.now() / 1000),
    exp:        Math.floor(Date.now() / 1000) + 86400,
  })

  // Clear any stale SIWE session cookie to avoid confusion
  clearCookie(res, 'session')

  return res.redirect(302, '/?session=' + sessionToken)
}
