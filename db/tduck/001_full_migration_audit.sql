-- Read-only audit. Run against tduck_vue3_dev; this migration adds no columns or tables.
SELECT DATABASE() AS current_database;
SELECT table_name, engine, table_collation
FROM information_schema.tables
WHERE table_schema = 'tduck_vue3_dev'
  AND table_name IN ('fm_user_form', 'fm_user_form_item', 'fm_user_form_data');
SELECT status, COUNT(*) AS forms FROM tduck_vue3_dev.fm_user_form GROUP BY status;
SELECT COUNT(*) AS persisted_answers FROM tduck_vue3_dev.fm_user_form_data;
-- No respondent text, account passwords, tokens or provider configuration are selected.
