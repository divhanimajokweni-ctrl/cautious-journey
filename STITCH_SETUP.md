# Stitch Setup

Set these Vercel environment variables before deploying:

- `STITCH_CLIENT_SECRET`: Stitch API client secret for server-side status reconciliation.
- `STITCH_WEBHOOK_SECRET`: Svix/Stitch Endpoint Secret (`endpoint_secret` in Bridge terminology) used by `api/stitch/webhook.js` to verify webhook signatures. This is not the Stitch client secret.
- `POOL_TOKEN_SECRET`: HMAC secret for WhatsApp pool access links.
- `POOL_TOKEN_ADMIN_SECRET`: Required admin secret for minting pool access links.

Webhook endpoint URL:

```text
https://<your-vercel-domain>/api/stitch/webhook
```

If using Svix Bridge as a receiver, configure its `endpoint_secret` to the same value as `STITCH_WEBHOOK_SECRET`. If registering this app directly as the Svix/Stitch endpoint, use the webhook endpoint URL above in the Stitch/Svix portal and copy that endpoint's signing secret into `STITCH_WEBHOOK_SECRET`.

The client secret is intentionally not stored in this repository. Keep Stitch credentials in Vercel project environment variables only.

Restricted console links use this route:

```text
https://<your-vercel-domain>/dashboard?poolToken=<minted-token>
```

Mint tokens from trusted automation only with `POST /api/pool-token/mint` and verify them with `POST /api/pool-token/verify`.
