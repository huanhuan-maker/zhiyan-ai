-- M4-R: append-only report snapshots and review audit. Existing answers are untouched.
USE tduck_vue3_dev;
CREATE TABLE IF NOT EXISTS fm_analysis_report (
 id VARCHAR(36) PRIMARY KEY,
 form_key VARCHAR(64) NOT NULL,
 version_no INT NOT NULL,
 snapshot_hash CHAR(64) NOT NULL,
 mode VARCHAR(16) NOT NULL,
 provider VARCHAR(160) NOT NULL,
 model VARCHAR(160) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 revision INT NOT NULL DEFAULT 0,
 snapshot_json JSON NOT NULL,
 output_json JSON NOT NULL,
 review_note VARCHAR(1000) NOT NULL DEFAULT '',
 created_at VARCHAR(32) NOT NULL,
 INDEX idx_analysis_version (form_key, version_no, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_analysis_review (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 report_id VARCHAR(36) NOT NULL,
 actor_id BIGINT NOT NULL,
 status VARCHAR(16) NOT NULL,
 revision INT NOT NULL,
 note VARCHAR(1000) NOT NULL,
 created_at VARCHAR(32) NOT NULL,
 UNIQUE KEY uk_review_revision (report_id, revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
