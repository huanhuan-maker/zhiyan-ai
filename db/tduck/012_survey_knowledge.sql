CREATE TABLE IF NOT EXISTS fm_survey_knowledge (
  id varchar(160) NOT NULL PRIMARY KEY,
  owner_id bigint NOT NULL,
  form_key varchar(64) NOT NULL,
  version_no int NOT NULL,
  fingerprint varchar(64) NOT NULL,
  snapshot_json json NOT NULL,
  indexed_at varchar(40) NOT NULL,
  UNIQUE KEY uk_knowledge_scope (owner_id,form_key,version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
