-- Adiciona tabelas independentes. Não altera campaigns, contacts, conversations
-- nem processed_events, e não remove registros ou índices existentes.
CREATE TABLE IF NOT EXISTS campaign_options (
 campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
 delivery_mode TEXT NOT NULL DEFAULT 'link' CHECK(delivery_mode IN ('link','file','both')),
 delivery_link TEXT NOT NULL DEFAULT '', file_json TEXT,
 tags_json TEXT NOT NULL DEFAULT '[]', thumbnail_url TEXT, publication_title TEXT
);
CREATE TABLE IF NOT EXISTS contact_labels (
 igsid TEXT NOT NULL REFERENCES contacts(igsid) ON DELETE CASCADE,
 label TEXT NOT NULL, PRIMARY KEY(igsid,label)
);
CREATE INDEX IF NOT EXISTS contact_labels_label ON contact_labels(label);
CREATE TABLE IF NOT EXISTS uploaded_files (
 id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 size INTEGER NOT NULL, type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- As etiquetas da campanha são aplicadas quando a entrega é registrada.
CREATE TRIGGER IF NOT EXISTS manochat_labels_after_delivery_update
AFTER UPDATE OF stage ON conversations WHEN NEW.stage='delivered' AND OLD.stage<>'delivered'
BEGIN
 INSERT OR IGNORE INTO contact_labels(igsid,label)
 SELECT NEW.igsid,CAST(value AS TEXT) FROM json_each(COALESCE(
 (SELECT tags_json FROM campaign_options WHERE campaign_id=NEW.campaign_id),'[]'))
 WHERE type='text' AND length(value)>0;
END;
CREATE TRIGGER IF NOT EXISTS manochat_labels_after_delivery_insert
AFTER INSERT ON conversations WHEN NEW.stage='delivered'
BEGIN
 INSERT OR IGNORE INTO contact_labels(igsid,label)
 SELECT NEW.igsid,CAST(value AS TEXT) FROM json_each(COALESCE(
 (SELECT tags_json FROM campaign_options WHERE campaign_id=NEW.campaign_id),'[]'))
 WHERE type='text' AND length(value)>0;
END;
