CREATE TABLE users (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(60) NOT NULL UNIQUE,
 password_hash VARCHAR(100) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE surveys (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 owner_id BIGINT NOT NULL,
 draft_json JSON NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
 latest_version_id BIGINT NULL,
 revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (owner_id) REFERENCES users(id),
 INDEX ix_surveys_owner(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE survey_versions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 survey_id BIGINT NOT NULL,
 version_number INT NOT NULL,
 snapshot_json JSON NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 published_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (survey_id) REFERENCES surveys(id),
 UNIQUE KEY uk_survey_version(survey_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE response_sessions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 survey_id BIGINT NOT NULL,
 version_id BIGINT NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 ai_consent BOOLEAN NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
 started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 completed_at DATETIME(6) NULL,
 FOREIGN KEY (survey_id) REFERENCES surveys(id),
 FOREIGN KEY (version_id) REFERENCES survey_versions(id),
 INDEX ix_sessions_version_status(version_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE answers (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 session_id BIGINT NOT NULL,
 question_id VARCHAR(64) NOT NULL,
 value_json JSON NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (session_id) REFERENCES response_sessions(id),
 UNIQUE KEY uk_answer_session_question(session_id,question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE audit_events (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 actor_id BIGINT NULL,
 survey_id BIGINT NOT NULL,
 action VARCHAR(40) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (survey_id) REFERENCES surveys(id),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
