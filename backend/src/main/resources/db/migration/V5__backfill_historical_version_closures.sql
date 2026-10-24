-- V4 may already be applied: preserve its checksum and repair historical closures separately.
-- Before V4, publishing after CLOSE set the survey back to OPEN and unintentionally reopened old links.
-- Reconstruct those old closed versions from retained CLOSE audit events; newer versions stay OPEN.
UPDATE survey_versions v
JOIN (
    SELECT survey_id, MAX(created_at) AS closed_at
    FROM audit_events WHERE action = 'CLOSE' GROUP BY survey_id
) c ON c.survey_id = v.survey_id
SET v.status = 'CLOSED'
WHERE v.status = 'OPEN' AND v.published_at <= c.closed_at;
