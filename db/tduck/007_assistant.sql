USE tduck_vue3_dev;
CREATE TABLE IF NOT EXISTS fm_assistant_conversation (
 id VARCHAR(36) PRIMARY KEY,
 owner_id BIGINT NOT NULL,
 title VARCHAR(120) NOT NULL,
 created_at VARCHAR(32) NOT NULL,
 updated_at VARCHAR(32) NOT NULL,
 INDEX idx_assistant_conversation_owner(owner_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_assistant_turn (
 id VARCHAR(36) PRIMARY KEY,
 conversation_id VARCHAR(36) NOT NULL,
 owner_id BIGINT NOT NULL,
 question VARCHAR(1000) NOT NULL,
 scope_form_key VARCHAR(64) NULL,
 scope_version INT NULL,
 plan_json JSON NULL,
 result_json JSON NULL,
 state VARCHAR(20) NOT NULL,
 mode VARCHAR(20) NOT NULL,
 provider VARCHAR(160) NOT NULL,
 model VARCHAR(160) NOT NULL,
 warning VARCHAR(500) NOT NULL DEFAULT '',
 created_at VARCHAR(32) NOT NULL,
 INDEX idx_assistant_turn_owner(owner_id,conversation_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
