CREATE TABLE IF NOT EXISTS fm_ai_draft_slot_lock (
  owner_id BIGINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_ai_draft_slot (
  owner_id BIGINT NOT NULL,
  slot_no TINYINT NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  snapshot_json JSON NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (owner_id, slot_no),
  UNIQUE KEY uq_ai_draft_workspace_id (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_ai_draft_migration_marker (
  marker VARCHAR(40) NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO fm_ai_draft_slot(owner_id,slot_no,workspace_id,snapshot_json,updated_at)
 SELECT owner_id,1,UUID(),snapshot_json,updated_at FROM fm_ai_draft_workspace
 WHERE NOT EXISTS (SELECT 1 FROM fm_ai_draft_migration_marker WHERE marker='legacy-workspace-to-slots');
INSERT IGNORE INTO fm_ai_draft_migration_marker(marker) VALUES('legacy-workspace-to-slots');
