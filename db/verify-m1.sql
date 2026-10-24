-- Read-only M1 evidence. No password/hash/capability tokens selected.
SELECT VERSION() AS mysql_version, DATABASE() AS database_name;
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
SELECT id, status, revision, JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.title')) AS draft_title
FROM surveys ORDER BY id;
SELECT id, survey_id, version_number,
       JSON_UNQUOTE(JSON_EXTRACT(snapshot_json,'$.title')) AS published_title
FROM survey_versions ORDER BY id;
SELECT version_id, status, COUNT(*) AS session_count
FROM response_sessions GROUP BY version_id, status;
SELECT s.version_id, a.question_id, COUNT(*) AS stored_answer_rows
FROM answers a JOIN response_sessions s ON s.id=a.session_id
WHERE s.status='SUBMITTED' GROUP BY s.version_id, a.question_id;
SELECT s.version_id, JSON_UNQUOTE(a.value_json) AS single_choice, COUNT(*) AS numerator
FROM answers a JOIN response_sessions s ON s.id=a.session_id
WHERE s.status='SUBMITTED' AND a.question_id='satisfaction'
GROUP BY s.version_id, JSON_UNQUOTE(a.value_json);
SELECT s.version_id, AVG(CAST(JSON_UNQUOTE(a.value_json) AS DECIMAL(10,2))) AS scale_average
FROM answers a JOIN response_sessions s ON s.id=a.session_id
WHERE s.status='SUBMITTED' AND a.question_id='score' GROUP BY s.version_id;
