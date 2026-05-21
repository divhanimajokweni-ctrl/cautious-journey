import { randomUUID, createHash, createHmac } from 'node:crypto'
import jwt from '../../lib/jwt.js'

/**
 * GET /api/auth/nonce
 * Returns a one-time nonce for SIWE sign-in.
 * The client signs the nonce with their wallet, then POSTs to /api/auth/verify.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET'] })

  const nonce = randomUUID().replace(/-/g, '')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ nonce, expires_in: 300 })
}
