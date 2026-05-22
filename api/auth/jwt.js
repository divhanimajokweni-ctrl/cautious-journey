import { createHmac } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/**
 * HMAC-SHA256 signed JWT — default export so consumers can use:
 *   import jwt from './jwt.js'          (from api/auth/*)
 *   import jwt from '../jwt.js'         (from api/auth/oauth/*)
 *   jwt.sign(...)
 *   jwt.verify(...)
 *
 * Secret: PROOFBRIDGE_HMAC_SECRET (production) or `dev-secret` fallback.
 */
const SECRET = process.env.PROOFBRIDGE_HMAC_SECRET || 'dev-secret'
const HEADER = { alg: 'HS256', typ: 'JWT' }

const jwt = {
  sign(claim) {
    const headerB64 = b64url(JSON.stringify(HEADER))
    const claimB64  = b64url(JSON.stringify(claim))
    const payload   = `${headerB64}.${claimB64}`
    const sig       = createHmac('sha256', SECRET).update(payload).digest('base64url')
    return `${payload}.${sig}`
  },

  verify(token) {
    const [hB64, cB64, sB64] = token.split('.')
    if (!hB64 || !cB64 || !sB64) throw new Error('MALFORMED_TOKEN')

    const header  = JSON.parse(Buffer.from(hB64, 'base64url').toString())
    const claim   = JSON.parse(Buffer.from(cB64, 'base64url').toString())
    const payload = `${hB64}.${cB64}`
    const sig     = createHmac('sha256', SECRET).update(payload).digest('base64url')

    if (!Buffer.from(sB64, 'base64url').equals(createHmac('sha256', SECRET).update(payload).digest())) throw new Error('INVALID_SIGNATURE')
    return { header, payload: claim }
  },
}

export default jwt
