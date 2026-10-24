-- Apply only to the isolated migration database. Existing answers remain unchanged.
USE tduck_vue3_dev;
CREATE TABLE IF NOT EXISTS fm_public_submission (
  form_key VARCHAR(64) NOT NULL,
  session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  answer_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (form_key, session_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
