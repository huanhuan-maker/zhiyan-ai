-- M5-B: server-managed providers, model profiles and encrypted credentials.
CREATE TABLE IF NOT EXISTS fm_ai_settings (
  id BIGINT NOT NULL PRIMARY KEY,
  revision INT NOT NULL DEFAULT 0,
  config_json LONGTEXT NOT NULL,
  updated_by BIGINT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
