PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  keyword TEXT NOT NULL COLLATE NOCASE,
  media_id TEXT,
  first_message TEXT NOT NULL,
  follow_message TEXT NOT NULL,
  delivery_message TEXT NOT NULL,
  delivery_url TEXT NOT NULL,
  follow_required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_media_keyword
ON campaigns(COALESCE(media_id, ''), keyword);

CREATE TABLE IF NOT EXISTS contacts (
  igsid TEXT PRIMARY KEY,
  username TEXT,
  follows_business INTEGER,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  igsid TEXT PRIMARY KEY REFERENCES contacts(igsid) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK(stage IN ('awaiting_reply', 'awaiting_follow', 'delivered')),
  source_comment_id TEXT,
  last_inbound_at TEXT,
  delivered_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  igsid TEXT,
  campaign_id INTEGER,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound', 'system')),
  status TEXT NOT NULL,
  external_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS interactions_created_at ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS interactions_campaign_id ON interactions(campaign_id);

INSERT OR IGNORE INTO campaigns
  (id, name, keyword, first_message, follow_message, delivery_message, delivery_url, follow_required)
VALUES
  (1, 'Minha primeira campanha', 'QUERO',
   'Oi! Vi seu comentário 😊 Responda QUERO aqui para eu liberar o conteúdo.',
   'Falta só um passo: siga o meu perfil e responda PRONTO por aqui.',
   'Perfeito! Aqui está o conteúdo que prometi:',
   'https://exemplo.com/seu-link', 1);
