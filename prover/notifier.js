// prover/notifier.js
// ProofBridge Liner — Multi-channel notification dispatcher
//
// Sends deployment and pipeline alerts to Slack (webhook) and/or email.
// Usage: call notify(eventType, { details }) from any pipeline stage.
// -------------------------------------------------------------------------

const https = require('https');
const fs = require('node:fs');
const path = require('node:path');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_CHANNEL     = process.env.SLACK_CHANNEL || '#proofbridge-alerts';

const LOG_FILE = path.resolve(__dirname, '..', '.local', 'logs', 'notifications.log');

// Event types used throughout the pipeline
const EVENTS = {
  DEPLOYMENT_START:    'deployment.start',
  DEPLOYMENT_SUCCESS:  'deployment.success',
  DEPLOYMENT_FAILURE:  'deployment.failure',
  FETCH_START:         'fetch.start',
  FETCH_COMPLETE:      'fetch.complete',
  FETCH_ERROR:         'fetch.error',
  SUBMIT_START:        'submit.start',
  SUBMIT_COMPLETE:     'submit.complete',
  SUBMIT_ERROR:        'submit.error',
  BROADCAST_START:     'broadcast.start',
  BROADCAST_SUCCESS:   'broadcast.success',
  BROADCAST_FAILURE:   'broadcast.failure',
  CIRCUIT_TRIP:        'circuit.trip',
  CIRCUIT_RESET:       'circuit.reset',
  AUDIT_COMPLETE:      'audit.complete',
  SYSTEM_ERROR:        'system.error',
};

// Colors per severity
const COLORS = {
  [EVENTS.DEPLOYMENT_START]:   '#6366f1',
  [EVENTS.DEPLOYMENT_SUCCESS]: '#22c55e',
  [EVENTS.DEPLOYMENT_FAILURE]: '#ef4444',
  [EVENTS.FETCH_START]:        '#3b82f6',
  [EVENTS.FETCH_COMPLETE]:     '#10b981',
  [EVENTS.FETCH_ERROR]:        '#f59e0b',
  [EVENTS.SUBMIT_START]:       '#8b5cf6',
  [EVENTS.SUBMIT_COMPLETE]:    '#14b8a6',
  [EVENTS.SUBMIT_ERROR]:       '#f97316',
  [EVENTS.BROADCAST_START]:    '#06b6d4',
  [EVENTS.BROADCAST_SUCCESS]:  '#22c55e',
  [EVENTS.BROADCAST_FAILURE]:  '#dc2626',
  [EVENTS.CIRCUIT_TRIP]:       '#dc2626',
  [EVENTS.CIRCUIT_RESET]:      '#84cc16',
  [EVENTS.AUDIT_COMPLETE]:     '#0ea5e9',
  [EVENTS.SYSTEM_ERROR]:       '#991b1b',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeLog(event, payload) {
  ensureLogDir();
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    payload,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// ─── Slack ──────────────────────────────────────────────────────────────────────

function slackPayload(event, data) {
  const color = COLORS[event] || '#64748b';
  const title = formatTitle(event);
  const fields = buildFields(event, data);

  return {
    username: 'ProofBridge Liner',
    icon_emoji: ':shield:',
    channel: SLACK_CHANNEL,
    attachments: [
      {
        color,
        fallback: `${title} — ${JSON.stringify(data)}`,
        title,
        title_link: process.env.REPLIT_DOMAIN
          ? `https://${process.env.REPLIT_DOMAIN}`
          : undefined,
        fields,
        footer: 'ProofBridge Liner v1.1.1',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

function formatTitle(event) {
  switch (event) {
    case EVENTS.DEPLOYMENT_START:   return '🚀 Deployment started';
    case EVENTS.DEPLOYMENT_SUCCESS: return '✅ Deployment succeeded';
    case EVENTS.DEPLOYMENT_FAILURE: return '❌ Deployment failed';
    case EVENTS.FETCH_START:        return '🔍 Fetch started';
    case EVENTS.FETCH_COMPLETE:     return '📥 Fetch complete';
    case EVENTS.FETCH_ERROR:        return '⚠️ Fetch error';
    case EVENTS.SUBMIT_START:       return '✍️ Submit started';
    case EVENTS.SUBMIT_COMPLETE:    return '📤 Submit complete';
    case EVENTS.SUBMIT_ERROR:       return '⚠️ Submit error';
    case EVENTS.BROADCAST_START:    return '📡 Broadcast started';
    case EVENTS.BROADCAST_SUCCESS:  return '📢 Broadcast confirmed';
    case EVENTS.BROADCAST_FAILURE:  return '❌ Broadcast failed';
    case EVENTS.CIRCUIT_TRIP:       return '🚨 Circuit TRIPPED';
    case EVENTS.CIRCUIT_RESET:      return '🔄 Circuit reset';
    case EVENTS.AUDIT_COMPLETE:     return '🔐 Audit report ready';
    case EVENTS.SYSTEM_ERROR:       return '💥 System error';
    default: return `Event: ${event}`;
  }
}

function buildFields(event, data) {
  const fields = [];

  // Common fields
  if (data.network)     fields.push({ title: 'Network', value: data.network, short: true });
  if (data.contract)    fields.push({ title: 'Contract', value: data.contract, short: true });
  if (data.address)     fields.push({ title: 'Address',  value: data.address,  short: true });
  if (data.txHash)      fields.push({ title: 'Tx Hash',  value: `\`${data.txHash}\``,  short: false });
  if (data.reason)      fields.push({ title: 'Reason',   value: data.reason,   short: false });
  if (data.error)       fields.push({ title: 'Error',    value: `\`${data.error}\``,    short: false });
  if (data.assetId)     fields.push({ title: 'Asset ID', value: `\`${data.assetId}\``,  short: false });
  if (data.count)       fields.push({ title: 'Count',    value: String(data.count),    short: true });
  if (data.latencyMs)   fields.push({ title: 'Latency',  value: `${data.latencyMs} ms`, short: true });
  if (data.uptime)      fields.push({ title: 'Uptime',   value: `${data.uptime}s`,      short: true });

  // Deployment-specific fields
  if (event.startsWith('deployment')) {
    if (data.target)    fields.push({ title: 'Target',   value: data.target,    short: true });
    if (data.mode)      fields.push({ title: 'Mode',     value: data.mode,      short: true });
    if (data.rpc)       fields.push({ title: 'RPC',      value: maskRpc(data.rpc), short: false });
  }

  // Broadcast-specific success metrics
  if (event === EVENTS.BROADCAST_SUCCESS) {
    if (data.gasUsed)   fields.push({ title: 'Gas used', value: data.gasUsed,  short: true });
    if (data.block)     fields.push({ title: 'Block',    value: data.block,    short: true });
  }

  return fields;
}

function maskRpc(url) {
  if (!url) return 'n/a';
  return url.replace(/\/\/.+@/, '//***@');
}

async function sendToSlack(payload) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[notifier] Slack webhook not configured — skipping.');
    return;
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send a notification event to all configured channels.
 *
 * @param {string} event   One of EVENTS
 * @param {object} data    Event-specific payload (addresses, txHash, error, etc.)
 * @returns {Promise<void>}
 */
async function notify(event, data = {}) {
  // 1. Audit log (always written)
  writeLog(event, data);

  // 2. Slack (if configured)
  if (SLACK_WEBHOOK_URL) {
    try {
      const payload = slackPayload(event, data);
      await sendToSlack(payload);
      console.log(`[notifier] ✓ Slack: ${formatTitle(event)}`);
    } catch (err) {
      console.error(`[notifier] ✗ Slack failed: ${err.message}`);
    }
  }
}

/**
 * Convenience wrappers for common events.
 */
const alerts = {
  deployment:   { start:   (d) => notify(EVENTS.DEPLOYMENT_START,   d),
                  success: (d) => notify(EVENTS.DEPLOYMENT_SUCCESS,  d),
                  failure: (d) => notify(EVENTS.DEPLOYMENT_FAILURE,  d) },

  fetch:        { start:   (d) => notify(EVENTS.FETCH_START,        d),
                  complete:(d) => notify(EVENTS.FETCH_COMPLETE,     d),
                  error:   (d) => notify(EVENTS.FETCH_ERROR,        d) },

  submit:       { start:   (d) => notify(EVENTS.SUBMIT_START,       d),
                  complete:(d) => notify(EVENTS.SUBMIT_COMPLETE,    d),
                  error:   (d) => notify(EVENTS.SUBMIT_ERROR,       d) },

  broadcast:    { start:   (d) => notify(EVENTS.BROADCAST_START,    d),
                  success: (d) => notify(EVENTS.BROADCAST_SUCCESS,  d),
                  failure: (d) => notify(EVENTS.BROADCAST_FAILURE,  d) },

  circuit:      { trip:    (d) => notify(EVENTS.CIRCUIT_TRIP,       d),
                  reset:   (d) => notify(EVENTS.CIRCUIT_RESET,      d) },

  audit:        { complete:(d) => notify(EVENTS.AUDIT_COMPLETE,     d) },

  error:        (d)       => notify(EVENTS.SYSTEM_ERROR,         d),
};

module.exports = {
  EVENTS,
  notify,
  alerts,

  // Individual convenience functions (legacy-compatible)
  deploymentStart:   (d) => alerts.deployment.start(d),
  deploymentSuccess: (d) => alerts.deployment.success(d),
  deploymentFailure: (d) => alerts.deployment.failure(d),

  fetchStart:        (d) => alerts.fetch.start(d),
  fetchComplete:     (d) => alerts.fetch.complete(d),
  fetchError:        (d) => alerts.fetch.error(d),

  submitStart:       (d) => alerts.submit.start(d),
  submitComplete:    (d) => alerts.submit.complete(d),
  submitError:       (d) => alerts.submit.error(d),

  broadcastStart:    (d) => alerts.broadcast.start(d),
  broadcastSuccess:  (d) => alerts.broadcast.success(d),
  broadcastFailure:  (d) => alerts.broadcast.failure(d),

  circuitTrip:       (d) => alerts.circuit.trip(d),
  circuitReset:      (d) => alerts.circuit.reset(d),

  auditComplete:     (d) => alerts.audit.complete(d),
  systemError:       (d) => alerts.error(d),
};
