import { verifyPoolToken } from '../pool-token/verify.js'

function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
}

function portalUrlWithNext(url, next) {
  if (!next) return url
  const parsed = new URL(url)
  parsed.searchParams.set('next', next)
  return parsed.toString()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed', allowed: ['POST'] })
  }

  const authToken = process.env.SVIX_AUTH_TOKEN
  const appId = process.env.SVIX_APP_ID
  const apiUrl = process.env.SVIX_API_URL || 'https://api.eu.svix.com'
  if (!authToken) return res.status(503).json({ ok: false, error: 'missing_svix_auth_token' })
  if (!appId) return res.status(503).json({ ok: false, error: 'missing_svix_app_id' })

  let body
  try {
    body = readBody(req)
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }

  const gate = verifyPoolToken(String(body.poolToken || body.token || ''))
  if (!gate.ok) return res.status(403).json(gate)

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/auth/app-portal-access/${encodeURIComponent(appId)}/`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      featureFlags: body.featureFlags || undefined,
      capabilities: body.capabilities || undefined,
      sessionId: `vvu-${gate.group}`,
    }),
  })

  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text || '{}')
  } catch {
    return res.status(502).json({ ok: false, error: 'invalid_svix_response' })
  }

  if (!response.ok) {
    return res.status(response.status).json({ ok: false, error: 'svix_app_portal_failed', details: payload })
  }

  return res.status(200).json({
    ok: true,
    group: gate.group,
    url: portalUrlWithNext(payload.url, body.next),
    token: payload.token,
  })
}
