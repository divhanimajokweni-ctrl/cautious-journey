/**
 * POST /api/auth/oauth/signout
 * Revokes the Vercel OAuth access token and clears all session cookies.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['POST'] })

  // Best-effort revocation — don't block the response on a failing API call
  const accessCookie = req.cookies?.access_token
  if (accessCookie) {
    try {
      const { token } = JSON.parse(Buffer.from(accessCookie, 'base64url').toString())
      await fetch('https://vercel.com/oauth/revoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({ token, client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID }),
      })
    } catch (_) { /* swallow revocation errors */ }
  }

  // Clear all auth cookies
  const expires = 'Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
  res.setHeader('Set-Cookie', [
    'access_token=; ' + expires,
    'refresh_token=; ' + expires,
    'oauth_verifier=; ' + expires,
    'session=; ' + expires,
  ])

  return res.status(204).end()
}
