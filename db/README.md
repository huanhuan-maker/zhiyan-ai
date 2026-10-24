# MySQL 8 migration

`scripts/Initialize-Database.ps1` creates only the two configured databases and a dedicated local app account; no existing data is dropped or existing password changed. App privileges are limited to these two databases.

The single source of truth is `backend/src/main/resources/db/migration/`. Flyway applies migrations on application/test startup and tracks checksums in `flyway_schema_history`. Do not manually re-run or edit an applied migration.

- V1: `system_checks` for M0 real Mapper connectivity.
- V2: `users`, `surveys`, `survey_versions`, `response_sessions`, `answers`, `audit_events` for M1. Stable question/option IDs live in draft/published JSON. Answers link to anonymous sessions, sessions link to a frozen version, surveys link to an owner. Passwords are BCrypt; public/session capability tokens are stored only as SHA-256 digests.
- V3: `answers.question_id` uses ASCII binary collation so case-sensitive IDs stay distinct.
- V4: `survey_versions.status` (OPEN/CLOSED) adds a per-version collection lifecycle. Versions of surveys already CLOSED at migration time are backfilled to CLOSED, so republishing later only reopens collection for the new version; token rotation only rewrites `token_hash`.

Bootstrap account configuration creates a database user only when absent; changing `.env` does not reset an existing password. Existing local databases have already been provisioned; do not overwrite `.env` or initialize MySQL's existing data directory.

Integration tests use `DB_TEST_NAME` (must end with `_test`), not the application database. Test inserts are rolled back/deleted; manual diagnostics remain in `DB_NAME`.

`verify-m1.sql` provides read-only checks without selecting passwords, hashes or capability tokens. Question IDs `satisfaction`/`score` in its final two queries correspond to `fixtures/m1_survey.json`. Actual results: `evidence/m1-mysql-query.txt`. New custom surveys should use their own IDs for the corresponding checks.

Backup: use MySQL Workbench Data Export, or `mysqldump -h 127.0.0.1 -u zhiyan -p --databases zhiyan_ai --result-file=backup.sql`; keep backups outside Git. Restore into a separate database before replacing any data. M1 survey answers may contain sensitive text; do not upload backups or raw answer logs.
