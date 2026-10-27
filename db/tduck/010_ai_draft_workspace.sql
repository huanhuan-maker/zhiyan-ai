USE tduck_vue3_dev;
CREATE TABLE IF NOT EXISTS fm_ai_draft_workspace (
  owner_id BIGINT NOT NULL PRIMARY KEY,
  snapshot_json JSON NOT NULL,
  updated_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
