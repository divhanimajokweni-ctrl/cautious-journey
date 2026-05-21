-- ProofBridge Liner — Stateful Risk Engine Schema
-- SQLite / PostgreSQL compatible (PostgreSQL noted where types differ)
-- Run once on first boot in /db/init.js

-- ── entities ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
    entity_id   TEXT PRIMARY KEY,
    alpha       REAL NOT NULL DEFAULT 1.0,
    beta        REAL NOT NULL DEFAULT 10.0,
    gamma       REAL NOT NULL DEFAULT 1.0,
    threshold   REAL NOT NULL DEFAULT 0.55,
    direction   TEXT NOT NULL DEFAULT 'CONTINUOUS',   -- CONTINUOUS | POSITIVE | NEGATIVE
    status      TEXT NOT NULL DEFAULT 'ACTIVE',       -- ACTIVE | HALTED | UNDER_REVIEW
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);

-- ── proposals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
    id               TEXT PRIMARY KEY,
    entity_id        TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    amount_cents     INTEGER NOT NULL,                 -- stored in cents to avoid floats
    currency         TEXT NOT NULL DEFAULT 'ZAR',
    beneficiary_bank TEXT,
    account_number   TEXT,
    status           TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | RISK_VERIFIED | EXECUTION_PENDING | SETTLED | FAILED
    transaction_id   TEXT,
    decision_id      TEXT,                              -- FK → decisions.id
    committee_votes  INTEGER DEFAULT 0,
    committee_total  INTEGER DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_entity   ON proposals(entity_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status   ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_decision ON proposals(decision_id);

-- ── decisions ───────────────────────────────────────────────────────────────
-- Each decision is an EIP-712 signed verdict from the oracle.
-- The nonce field prevents replay; entity_id + nonce must be unique.
CREATE TABLE IF NOT EXISTS decisions (
    id            TEXT PRIMARY KEY,         -- UUID v4
    entity_id     TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    belief        REAL NOT NULL,           -- 0..1
    threshold     REAL NOT NULL,           -- 0..1
    verdict       TEXT NOT NULL,           -- PASS | WARN | HALT
    signature     TEXT NOT NULL,           -- EIP-712 hex signature
    nonce         INTEGER NOT NULL,
    proposal_id   TEXT REFERENCES proposals(id),
    -- canonical message hashed and signed (for audit trail)
    message_hash  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(entity_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_decisions_entity ON decisions(entity_id);
CREATE INDEX IF NOT EXISTS idx_decisions_proposal ON decisions(proposal_id);

-- ── events ─────────────────────────────────────────────────────────────────
-- Ingested risk / activity events that feed the Bayesian engine.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id   TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    direction   TEXT NOT NULL,             -- POSITIVE | NEGATIVE | NEUTRAL
    weight      REAL NOT NULL DEFAULT 1.0, -- importance multiplier (0..10)
    -- Optional contextual metadata
    meta        TEXT,                      -- JSON string
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_id);

-- ── updates trigger ─────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_entities_updated
    AFTER UPDATE ON entities
    FOR EACH ROW UPDATE entities SET updated_at = datetime('now') WHERE entity_id = NEW.entity_id;

CREATE TRIGGER IF NOT EXISTS trg_proposals_updated
    AFTER UPDATE ON proposals
    FOR EACH ROW UPDATE proposals SET updated_at = datetime('now') WHERE id = NEW.id;

-- ── bootstrap ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO entities (entity_id, alpha, beta, gamma, threshold, direction)
VALUES ('stokvel_123', 1.0, 10.0, 1.0, 0.55, 'CONTINUOUS');

-- ============================================================================
-- Stitch / Svix webhook persistence (Postgres / Supabase)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id           TEXT PRIMARY KEY,                     -- svix-id
    event_type   TEXT NOT NULL,
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ DEFAULT now(),

    processed    BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,

    status       TEXT DEFAULT 'pending',               -- pending | success | failed | skipped
    error        TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    TEXT,
    stitch_id  TEXT,
    status     TEXT,                                   -- active | inactive | failed
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stitch_payment_id  TEXT,
    amount             NUMERIC,
    currency           TEXT,
    status             TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);
