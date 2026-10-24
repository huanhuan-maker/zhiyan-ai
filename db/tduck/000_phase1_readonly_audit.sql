-- TDuck Vue 3 migration phase 1: read-only audit, NOT a schema migration.
-- Run against the isolated clone only. No TDuck table/column changes are needed.
-- Creation/restoration of tduck_vue3_dev is guarded by scripts/tduck/Initialize-Dev.ps1.
USE tduck_vue3_dev;
SELECT VERSION() AS mysql_version, DATABASE() AS current_database;
SELECT COUNT(*) AS table_count FROM information_schema.tables
WHERE table_schema = DATABASE();
SELECT COUNT(*) AS form_count FROM fm_user_form;
SELECT COUNT(*) AS item_count FROM fm_user_form_item;
SELECT COUNT(*) AS response_count FROM fm_user_form_data;
