# MySQL 8 migration

`scripts/Initialize-Database.ps1` creates only the two configured databases and a dedicated local app account; no existing data is dropped or existing password changed. App privileges are limited to these two databases.

The single source of truth for schema is `backend/src/main/resources/db/migration/V1__system_checks.sql`. Flyway applies it on application/test startup and tracks checksums in `flyway_schema_history`. Do not manually re-run or edit an applied migration.

Integration tests use `DB_TEST_NAME` (must end with `_test`), not the application database. Test inserts are rolled back/deleted; manual diagnostics remain in `DB_NAME`.

Backup: use MySQL Workbench Data Export, or `mysqldump -h 127.0.0.1 -u zhiyan -p --databases zhiyan_ai --result-file=backup.sql`; keep backups outside Git. Restore into a separate database before replacing any data. M0 contains no survey/answer tables.
