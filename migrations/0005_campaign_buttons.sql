-- Additive migration: does not modify campaigns, contacts, credentials or existing conversations.
CREATE TABLE IF NOT EXISTS campaign_buttons (
  campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL DEFAULT '{"first":[],"follow":[],"delivery":[]}'
);

-- Short-lived leases prevent two simultaneous clicks from delivering twice.
CREATE TABLE IF NOT EXISTS conversation_locks (
  igsid TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
