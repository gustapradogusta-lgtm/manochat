ALTER TABLE campaigns
ADD COLUMN match_all_comments INTEGER NOT NULL DEFAULT 0
CHECK(match_all_comments IN (0, 1));
