/**
 * POST /api/auth/signout
 * Revokes the session. In a stateless JWT model, this is a no-op server-side;
 * the client must discard the token. Returns 204 to signal success.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['POST'] })

  return res.status(204).end()
}
