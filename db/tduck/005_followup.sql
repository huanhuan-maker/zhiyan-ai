-- M3: only new tables. Existing published forms have follow-up disabled until republished.
CREATE TABLE IF NOT EXISTS fm_followup_policy (
 form_key varchar(50) NOT NULL, version_no int NOT NULL,
 config_json longtext NOT NULL,
 PRIMARY KEY (form_key, version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_followup_session (
 id varchar(36) NOT NULL, token_hash char(64) NOT NULL,
 form_key varchar(50) NOT NULL, version_no int NOT NULL,
 submission_hash char(64) NOT NULL, policy_json longtext NOT NULL,
 consent tinyint NOT NULL DEFAULT 0, used int NOT NULL DEFAULT 0,
 status varchar(24) NOT NULL, created_at bigint NOT NULL, expires_at bigint NOT NULL,
 answer_data_id bigint NULL,
 PRIMARY KEY (id), UNIQUE KEY uk_followup_capability (token_hash),
 KEY idx_followup_form (form_key, version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_followup_core_answer (
 id bigint NOT NULL AUTO_INCREMENT, session_id varchar(36) NOT NULL,
 question_id varchar(100) NOT NULL, answer_text text NOT NULL,
 created_at bigint NOT NULL, answer_data_id bigint NULL,
 PRIMARY KEY (id), UNIQUE KEY uk_followup_source (session_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_followup_decision (
 id bigint NOT NULL AUTO_INCREMENT, session_id varchar(36) NOT NULL,
 source_answer_id bigint NOT NULL, question_id varchar(100) NOT NULL,
 action varchar(16) NOT NULL, reason_code varchar(64) NOT NULL,
 state varchar(32) NOT NULL, question_text varchar(1000) NOT NULL DEFAULT '',
 evidence_quote varchar(500) NOT NULL DEFAULT '', response_text text NULL,
 budget_remaining int NOT NULL, policy_version varchar(64) NOT NULL,
 provider varchar(100) NOT NULL, model varchar(120) NOT NULL,
 elapsed_ms bigint NOT NULL DEFAULT 0, estimated_cost_micros bigint NULL,
 cost_basis varchar(40) NOT NULL DEFAULT 'NOT_REPORTED',
 created_at bigint NOT NULL, updated_at bigint NOT NULL,
 PRIMARY KEY (id), UNIQUE KEY uk_followup_decision (source_answer_id),
 KEY idx_followup_decisions (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fm_followup_event (
 id bigint NOT NULL AUTO_INCREMENT, session_id varchar(36) NOT NULL,
 source_answer_id bigint NULL, decision_id bigint NULL,
 from_state varchar(32) NOT NULL, to_state varchar(32) NOT NULL,
 reason_code varchar(64) NOT NULL, created_at bigint NOT NULL,
 PRIMARY KEY (id), KEY idx_followup_events (session_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
