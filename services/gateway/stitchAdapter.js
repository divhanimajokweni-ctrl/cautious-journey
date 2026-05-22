/**
 * services/gateway/stitchAdapter.js
 * ----------------------------------------------------------
 * SA banking execution bridge — Stitch Money API client.
 *
 * Supported operations:
 *   - OAuth2 client_credentials token acquisition
 *   - Instant EFT payment initiation
 *   - Transaction status retrieval
 *
 * Required environment variables:
 *   STITCH_CLIENT_ID       — OAuth2 client ID
 *   STITCH_CLIENT_SECRET   — OAuth2 client secret
 *   STITCH_SECRET          — HMAC webhook secret (for webhook verification, used elsewhere)
 *
 * Optional:
 *   STITCH_API_BASE_URL    — override default https://api.stitch.money
 *
 * Uses `axios` (already in root package.json ^1.7.2).
 * ESM module.
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a required environment variable or throw.
 * @param {string} name
 */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/**
 * Build a Stitch API error from a caught axios error.
 * @param {import('axios').AxiosError} err
 * @param {string} context
 * @returns {{ error: string, status: number, detail?: string }}
 */
function stitchError(err, context = 'Stitch API') {
  const status = err.response?.status || 500;
  const detail = err.response?.data
    ? typeof err.response.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response.data)
    : err.message;
  return {
    error: `${context} failed: HTTP ${status}`,
    status,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * Stitch Gateway Adapter — encapsulates all Stitch Money API interactions.
 */
class StitchGatewayAdapter {
  /**
   * @param {object} [options={}]
   * @param {string} [options.clientId]         — overrides STITCH_CLIENT_ID
   * @param {string} [options.clientSecret]     — overrides STITCH_CLIENT_SECRET
   * @param {string} [options.baseUrl]          — overrides STITCH_API_BASE_URL
   */
  constructor(options = {}) {
    this.clientId     = options.clientId     || process.env.STITCH_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.STITCH_CLIENT_SECRET;
    this.baseUrl      = (options.baseUrl     || process.env.STITCH_API_BASE_URL || 'https://api.stitch.money')
                          .replace(/\/+$/, '');

    // Lazy-loaded OAuth2 token — populated on first call to getAccessToken()
    this._accessToken  = null;
    this._tokenExpiry  = null; // unix ms

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'StitchGatewayAdapter: clientId and clientSecret are required. ' +
        'Set STITCH_CLIENT_ID and STITCH_CLIENT_SECRET environment variables.'
      );
    }
  }

  // ── OAuth2 ────────────────────────────────────────────────────────────────

  /**
   * Obtain a client_credentials OAuth2 access token from Stitch.
   * Caches the token until it expires.
   *
   * @returns {Promise<string>} bearer token
   */
  async getAccessToken() {
    // Return cached token if still valid (>60 s TTL buffer)
    if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry - 60_000) {
      return this._accessToken;
    }

    const tokenUrl = `${this.baseUrl}/oauth/token`;

    try {
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const token    = response.data?.access_token;
      const expiresIn = Number(response.data?.expires_in || 3600);

      if (!token) {
        throw new Error('Stitch OAuth2 response missing access_token');
      }

      this._accessToken = token;
      this._tokenExpiry = Date.now() + expiresIn * 1000;

      return token;
    } catch (err) {
      const e = stitchError(err, 'Stitch OAuth2');
      const apiErr = new Error(e.error);
      apiErr.status  = e.status;
      apiErr.detail  = e.detail;
      throw apiErr;
    }
  }

  // ── Payment Initiation ─────────────────────────────────────────────────────

  /**
   * Request an instant EFT payment via Stitch.
   *
   * @param {object} params
   * @param {string} params.reference          — idempotency / client reference
   * @param {number} params.amount             — Rands (decimal, e.g. 1500.00)
   * @param {string} params.beneficiary_bank   — bank code or name (Stitch bank code preferred)
   * @param {string} params.account_number     — beneficiary account number
   * @param {string} [params.currency='ZAR']
   * @returns {Promise<{ ok: true, transactionId: string, status: string, amount: number, reference: string }>}
   * @throws {Error}  { error, status }
   */
  async initiateInstantEFT({ reference, amount, beneficiary_bank, account_number, currency = 'ZAR' }) {
    if (!reference)  throw new TypeError('reference is required');
    if (!amount || Number(amount) <= 0) throw new TypeError('amount must be a positive number (Rands)');
    if (!beneficiary_bank)  throw new TypeError('beneficiary_bank is required');
    if (!account_number)    throw new TypeError('account_number is required');

    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments/instant-eft`,
        {
          reference,
          amount:     Number(amount).toFixed(2),
          currency,
          beneficiary_bank,
          account_number,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
        }
      );

      const data = response.data || {};
      return {
        ok:           true,
        transactionId: data.id || data.transaction_id || data.payment_id || '',
        status:       data.status || 'initiated',
        amount:       Number(data.amount || amount),
        reference:    data.reference || reference,
      };
    } catch (err) {
      const e = stitchError(err, 'Stitch initiateInstantEFT');
      const apiErr = new Error(e.error);
      apiErr.status = e.status;
      apiErr.detail = e.detail;
      throw apiErr;
    }
  }

  // ── Transaction Lookup ─────────────────────────────────────────────────────

  /**
   * Retrieve the current status of a previously-initiated transaction.
   *
   * @param {string} transactionId
   * @returns {Promise<{ id: string, status: string, amount: number, reference: string, created_at: string }>}
   * @throws {Error}  { error, status }
   */
  async getTransaction(transactionId) {
    if (!transactionId) throw new TypeError('transactionId is required');

    const token = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${encodeURIComponent(transactionId)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = response.data || {};
      return {
        id:         data.id || transactionId,
        status:     data.status || 'unknown',
        amount:     Number(data.amount || 0),
        reference:  data.reference || data.client_reference || '',
        created_at: data.created_at || null,
      };
    } catch (err) {
      const e = stitchError(err, 'Stitch getTransaction');
      const apiErr = new Error(e.error);
      apiErr.status = e.status;
      apiErr.detail = e.detail;
      throw apiErr;
    }
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { StitchGatewayAdapter };
export default StitchGatewayAdapter;
