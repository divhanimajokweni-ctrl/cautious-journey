/**
 * services/state/db.js
 * ----------------------------------------------------------
 * File-backed key-value store for Vercel ephemeral environments
 * (no SQL / Postgres / SQLite runtime available).
 *
 * Storage file:
 *   process.env.DB_PATH || path.join(process.cwd(), '.local/state/db.json')
 *
 * Schema (top-level keys live side-by-side in a single JSON file):
 *   entities   — Map<entity_id, EntityStats>
 *   proposals  — Map<proposal_id, Proposal>
 *   decisions  — Map<decision_id, Decision>
 *   events     — Array<EventRecord>  (append-only, bounded to last 10 000)
 *
 * EntityStats shape:
 *   { entity_id, alpha, beta, gamma, event_count, posterior, lastUpdated }
 *
 * Proposal shape:
 *   {
 *     id, entity_id, status, amount_cents, currency,
 *     beneficiary_bank, account_number, reference,
 *     created_at, updated_at, risk_score, decision_id, transaction_id
 *   }
 *   Status values: PENDING | RISK_VERIFIED | RISK_REJECTED |
 *                  EXECUTION_PENDING | SETTLED | FAILED | CANCELLED
 *
 * Event shape:
 *   { id: uuid, entity_id, direction, weight, meta, created_at }
 *   direction ∈ {POSITIVE | NEGATIVE | NEUTRAL}
 *
 * Decision shape:
 *   {
 *     id, entity_id, belief_bp, threshold_bp, verdict,
 *     signature, nonce, timestamp, domain, types, value,
 *     posterior, calibrated_threshold, margin, created_at
 *   }
 *
 * All reads/writes use fs.promises with atomic file writes
 * (write to tmp → rename) to avoid torn reads under concurrent access.
 *
 * ESM module — tree-shakeable, no side effects on import.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_DB_PATH = path.join(process.cwd(), '.local', 'state', 'db.json');

function getDbPath() {
  return process.env.DB_PATH || DEFAULT_DB_PATH;
}

// ---------------------------------------------------------------------------
// Low-level file helpers
// ---------------------------------------------------------------------------

/** @type {() => Promise<Record<string, any>>} */
class FileLock {
  constructor(p) {
    this.p = p;
    // Ephemeral lock file path
    this.lockPath = p + '.lock';
  }

  async acquire() {
    // Best-effort: create lock file, wait if it exists
    let tries = 0;
    while (true) {
      try {
        await fs.writeFile(this.lockPath, String(process.pid), { flag: 'wx' });
        return;
      } catch (err) {
        if (err.code === 'EEXIST' && tries < 20) {
          tries++;
          // eslint-disable-next-line no-await-in-loop
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        throw err;
      }
    }
  }

  async release() {
    await fs.unlink(this.lockPath).catch(() => {});
  }
}

/** Atomic write: write to temp file then rename. */
async function atomicWrite(filePath, data) {
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/** Read and parse the DB file; returns an empty shell if the file does not exist. */
async function readDb() {
  const p = getDbPath();
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { entities: {}, proposals: {}, decisions: {}, events: [] };
    throw err;
  }
}

/** Write the in-memory DB back to disk atomically. */
async function writeDb(data) {
  const lock = new FileLock(getDbPath());
  try {
    await lock.acquire();
    await atomicWrite(getDbPath(), data);
  } finally {
    await lock.release();
  }
}

/** Ensure the DB file exists (creates parent directory and empty file). */
async function ensureDb() {
  const p = getDbPath();
  try {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, '{}', 'utf-8');
  } catch {
    // File may already exist — ignore EEXIST
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ── Entity ───────────────────────────────────────────────────────────────────

/**
 * Return the stats record for an entity, creating it if absent.
 * @param {string} entity_id
 * @returns {Promise<{ entity_id: string, alpha: number, beta: number, gamma: number, event_count: number, posterior: number, lastUpdated: string }>}
 */
export async function getOrCreateEntityStats(entity_id) {
  await ensureDb();
  const db = await readDb();

  if (!db.entities[entity_id]) {
    db.entities[entity_id] = {
      entity_id,
      alpha: 0,
      beta: 0,
      gamma: 1.0,
      event_count: 0,
      posterior: 0,
      lastUpdated: new Date().toISOString(),
    };
    await writeDb(db);
  }

  return db.entities[entity_id];
}

/** @type {(entity_id: string) => Promise<object | undefined>} */
export function getEntity(entity_id) {
  return (async () => {
    const db = await readDb();
    return db.entities[entity_id] || undefined;
  })();
}

/** @type {(entity: object) => Promise<void>} */
export async function setEntity(entity) {
  await ensureDb();
  const db = await readDb();
  db.entities[entity.entity_id] = entity;
  await writeDb(db);
}

// ── Events ───────────────────────────────────────────────────────────────────

const MAX_EVENTS = 10_000;

/**
 * Record a risk event and update the parent entity's alpha/beta/posterior.
 * @param {object} event  { entity_id, direction: 'POSITIVE'|'NEGATIVE'|'NEUTRAL', weight: number, meta?: object }
 * @returns {Promise<{ id: string, event_id: string, entity_id: string, alpha: number, beta: number, posterior: number }>}
 */
export async function recordEvent(event) {
  await ensureDb();
  const db = await readDb();
  const entity_id = event.entity_id;

  if (!entity_id) throw new Error('recordEvent: entity_id is required');

  // Ensure entity exists
  if (!db.entities[entity_id]) {
    await getOrCreateEntityStats(entity_id);
  }

  const eventRecord = {
    id: randomUUID(),
    entity_id,
    direction: event.direction || 'NEUTRAL',
    weight:    Number(event.weight) || 0,
    meta:      event.meta || null,
    created_at: new Date().toISOString(),
  };

  db.events.push(eventRecord);

  // Trim events array if it exceeds the cap
  if (db.events.length > MAX_EVENTS) {
    db.events = db.events.slice(-MAX_EVENTS);
  }

  // Update entity alpha / beta
  const ent = db.entities[entity_id];
  if (event.direction === 'POSITIVE') {
    ent.alpha += eventRecord.weight;
  } else if (event.direction === 'NEGATIVE') {
    ent.beta += eventRecord.weight;
  }
  // NEUTRAL bumps neither

  ent.event_count   = (ent.event_count || 0) + 1;
  ent.lastUpdated   = eventRecord.created_at;
  ent.posterior     = (ent.alpha + 1) / (ent.alpha + ent.beta + 2);

  await writeDb(db);

  return {
    id:        eventRecord.id,
    event_id:  eventRecord.id,
    entity_id,
    alpha:     ent.alpha,
    beta:      ent.beta,
    posterior: Number(ent.posterior.toFixed(6)),
  };
}

/**
 * Retrieve events for an entity, newest-first, optionally limited.
 * @param {string} entity_id
 * @param {number} [limit=100]
 * @returns {Promise<Array<object>>}
 */
export async function getEntityEvents(entity_id, limit = 100) {
  const db = await readDb();
  const evts = db.events
    .filter((e) => e.entity_id === entity_id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return limit > 0 ? evts.slice(0, limit) : evts;
}

// ── Proposals ────────────────────────────────────────────────────────────────

const PROPOSAL_STATUSES = [
  'PENDING', 'RISK_VERIFIED', 'RISK_REJECTED',
  'EXECUTION_PENDING', 'SETTLED', 'FAILED', 'CANCELLED',
];

/**
 * Create a new proposal. A UUID is generated automatically; status defaults to PENDING.
 * @param {object} proposal  { entity_id, amount_cents, currency?, beneficiary_bank, account_number, reference?, meta? }
 * @returns {Promise<object>}
 */
export async function createProposal(proposal) {
  await ensureDb();
  const db = await readDb();

  const id = randomUUID();
  const now = new Date().toISOString();

  db.proposals[id] = {
    id,
    entity_id:       String(proposal.entity_id || ''),
    status:          'PENDING',
    amount_cents:    Number(proposal.amount_cents) || 0,
    currency:        proposal.currency || 'ZAR',
    beneficiary_bank: String(proposal.beneficiary_bank || ''),
    account_number:  String(proposal.account_number || ''),
    reference:       proposal.reference || null,
    meta:            proposal.meta || null,
    risk_score:      null,
    decision_id:     null,
    transaction_id:  null,
    created_at:      now,
    updated_at:      now,
  };

  await writeDb(db);
  return db.proposals[id];
}

/** @type {(id: string) => Promise<object | undefined>} */
export async function getProposal(id) {
  const db = await readDb();
  return db.proposals[id] || undefined;
}

/**
 * Update a proposal by id with a partial patch object.
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object | undefined>}
 */
export async function updateProposal(id, patch) {
  await ensureDb();
  const db = await readDb();
  const proposal = db.proposals[id];
  if (!proposal) return undefined;

  if (patch.status && !PROPOSAL_STATUSES.includes(patch.status)) {
    throw new Error(
      `Invalid proposal status "${patch.status}". Allowed: ${PROPOSAL_STATUSES.join(', ')}`
    );
  }

  Object.assign(proposal, patch, { updated_at: new Date().toISOString() });
  await writeDb(db);
  return proposal;
}

/**
 * List proposals, optionally filtered by status and/or entity_id.
 * @param {object} [filters={}]  { status?: string, entity_id?: string }
 * @param {number} [limit=50]
 * @returns {Promise<Array<object>>}
 */
export async function listProposals(filters = {}, limit = 50) {
  const db = await readDb();
  let list = Object.values(db.proposals || {});

  if (filters.status) {
    list = list.filter((p) => p.status === filters.status);
  }
  if (filters.entity_id) {
    list = list.filter((p) => p.entity_id === filters.entity_id);
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list.slice(0, limit);
}

/**
 * Get all proposals for a given entity_id.
 * @param {string} entity_id
 * @param {number} [limit=50]
 * @returns {Promise<Array<object>>}
 */
export async function getProposalsByEntity(entity_id) {
  return listProposals({ entity_id });
}

// ── Decisions ────────────────────────────────────────────────────────────────

/**
 * Persist a signed decision record.
 * @param {object} decision
 * @returns {Promise<object>}
 */
export async function saveDecision(decision) {
  await ensureDb();
  const db = await readDb();

  const id = decision.id || randomUUID();
  const record = {
    id,
    entity_id:     decision.entity_id,
    belief_bp:     decision.belief,
    threshold_bp:  decision.threshold,
    verdict:       decision.verdict,
    signature:     decision.signature,
    nonce:         decision.nonce,
    timestamp:     decision.timestamp,
    domain:        decision.domain || null,
    types:         decision.types || null,
    posterior:     decision.posterior || null,
    calibrated_threshold: decision.calibrated_threshold || null,
    margin:        decision.margin || null,
    created_at:    decision.created_at || new Date().toISOString(),
  };

  db.decisions[id] = record;
  await writeDb(db);
  return record;
}

/**
 * Fetch a decision by entity_id, optionally filtered by nonce.
 * Returns the most recent match.
 * @param {string} entity_id
 * @param {number} [nonce]
 * @returns {Promise<object | undefined>}
 */
export async function getDecision(entity_id, nonce) {
  const db = await readDb();
  let list = Object.values(db.decisions || {}).filter((d) => d.entity_id === entity_id);

  if (nonce !== undefined) {
    list = list.filter((d) => Number(d.nonce) === Number(nonce));
  }

  if (list.length === 0) return undefined;

  // Sort descending by timestamp, return most recent
  list.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  return list[0];
}
