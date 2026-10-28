-- M5-M: every account can keep its own model provider endpoint and encrypted API key.
-- No personal row means the account inherits the shared fm_ai_settings default.
CREATE TABLE IF NOT EXISTS fm_ai_settings_user (
  user_id BIGINT NOT NULL PRIMARY KEY,
  revision INT NOT NULL DEFAULT 0,
  config_json LONGTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
