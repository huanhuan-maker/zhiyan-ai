# M4-R additive backend sources

This directory is tracked source, not generated build output. `scripts/tduck/Build-FullBackend.ps1` copies these module-relative files after applying the existing backend patches. The original checkout remains unchanged. Compile using Java 17, Spring Boot and MyBatis-Plus in the existing Maven reactor; no extra server or ORM is introduced.

`AnalysisSnapshotService` captures repeatable-read version statistics and bounded evidence, fingerprints source answers, and omits IP/account fields from model input. `AnalysisOutputValidator` accepts known evidence references only, derives support counts, and rejects invented fields/quotes, numeric interpretations, malformed/deep JSON, duplicate keys and trailing output. Semantic correctness still requires human review.

`AnalysisReportService` calls the existing server-side provider outside database transactions. Real generation requires transfer authorization plus a matching preview fingerprint; local grouping is explicitly not a model. Reports store immutable fact/evidence/output JSON snapshots; status and notes use optimistic revisions and append-only review records. Changed input blocks approval. Exports escape untrusted Markdown and preserve provenance.

Migration: `db/tduck/006_analysis_report.sql` (two new tables, repeatable; no old answer migration). Configuration/secrets remain only in ignored `.local`. See `docs/ANALYSIS_STAGE.md` and `evidence/M4-R.md` for acceptance and limitations.
