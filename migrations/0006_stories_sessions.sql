-- Additive and repeatable: existing campaigns and credentials are preserved.
CREATE TABLE IF NOT EXISTS campaign_triggers (
 campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
 trigger_type TEXT NOT NULL DEFAULT 'comment' CHECK(trigger_type IN ('comment','story')),
 story_id TEXT,
 story_link_id TEXT,
 story_link TEXT,
 story_username TEXT
);
CREATE TABLE IF NOT EXISTS automation_sessions (
 igsid TEXT PRIMARY KEY REFERENCES contacts(igsid) ON DELETE CASCADE,
 source_type TEXT NOT NULL CHECK(source_type IN ('comment','story')),
 source_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','sending','delivered','failed','closed')),
 source_event_at INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_locks (
 igsid TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO automation_sessions(igsid,source_type,source_id,state,source_event_at,started_at,expires_at)
 SELECT igsid,'comment',source_comment_id,CASE WHEN stage='delivered' THEN 'delivered' ELSE 'active' END,0,
 CAST(strftime('%s','now') AS INTEGER)*1000,CAST(strftime('%s','now') AS INTEGER)*1000+86400000
 FROM conversations WHERE source_comment_id IS NOT NULL;
