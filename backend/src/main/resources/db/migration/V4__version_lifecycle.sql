-- 版本级收集状态：调查整体状态（surveys.status）不再单独决定旧版本能否填写。
-- 已关闭调查的全部历史版本固化为 CLOSED，发布新版本只恢复新版收集，旧版保持关闭。
ALTER TABLE survey_versions
 ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'OPEN' AFTER token_hash;

UPDATE survey_versions v JOIN surveys s ON v.survey_id = s.id
   SET v.status = 'CLOSED'
 WHERE s.status = 'CLOSED';
