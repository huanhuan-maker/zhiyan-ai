USE tduck_vue3_dev;
CREATE TABLE IF NOT EXISTS fm_assistant_action (
 turn_id VARCHAR(36) PRIMARY KEY,
 owner_id BIGINT NOT NULL,
 action VARCHAR(32) NOT NULL,
 decision VARCHAR(20) NOT NULL,
 proposal_json JSON NOT NULL,
 result_json JSON NOT NULL,
 created_at VARCHAR(32) NOT NULL,
 INDEX idx_assistant_action_owner(owner_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
