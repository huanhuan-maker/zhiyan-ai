-- M1 缺陷修复迁移（配合 scripts/tduck/Apply-FixMigration.ps1 幂等执行，只允许作用于隔离库 tduck_vue3_dev）
-- 1) 版本快照补全：表单信息(标题/描述/类型)/显示逻辑/主题随发布版本冻结，旧链接不再受草稿修改影响
-- 2) 提交回执按 (form_key, session_hash, version_no) 分键：同一会话键跨发布版本各自计数，不互相吞答卷
USE tduck_vue3_dev;

ALTER TABLE fm_user_form_version ADD COLUMN form_snapshot JSON NULL;
ALTER TABLE fm_user_form_version ADD COLUMN logic_snapshot JSON NULL;
ALTER TABLE fm_user_form_version ADD COLUMN theme_snapshot JSON NULL;

-- 历史版本回填（仅空值行）：题目在既有冻结策略下未被改动；
-- 标题/逻辑/主题的发布时原值不可再考，按当前值回填（已知边界，记录于 evidence/tduck-full/M1_VERSIONS.md）；
-- 空集合哨兵：[]=发布时无逻辑、{}=发布时无主题，NULL=无快照（历史版本，读取时回退当前值）
UPDATE fm_user_form_version v JOIN fm_user_form f ON f.form_key = v.form_key
SET v.form_snapshot = JSON_OBJECT('name', f.name, 'description', f.description, 'type', f.type)
WHERE v.form_snapshot IS NULL;
UPDATE fm_user_form_version v LEFT JOIN fm_user_form_theme t ON t.form_key = v.form_key
SET v.theme_snapshot = CASE WHEN t.form_key IS NULL THEN JSON_OBJECT() ELSE JSON_OBJECT(
  'logoImg', t.logo_img, 'logoPosition', t.logo_position, 'headImgUrl', t.head_img_url,
  'themeColor', t.theme_color, 'submitBtnText', t.submit_btn_text, 'backgroundColor', t.background_color,
  'backgroundImg', t.background_img, 'showTitle', t.show_title, 'showDescribe', t.show_describe,
  'showNumber', t.show_number, 'showSubmitBtn', t.show_submit_btn) END
WHERE v.theme_snapshot IS NULL;
UPDATE fm_user_form_version v LEFT JOIN fm_user_form_logic l ON l.form_key = v.form_key
SET v.logic_snapshot = CASE WHEN l.form_key IS NULL THEN JSON_ARRAY() ELSE CAST(l.scheme AS JSON) END
WHERE v.logic_snapshot IS NULL;

ALTER TABLE fm_public_submission ADD COLUMN version_no INT NOT NULL DEFAULT 0;
-- 既有回执按其答卷所属版本回填（无版本答卷记 0，与未版本化问卷兼容）
UPDATE fm_public_submission r LEFT JOIN fm_user_form_data d ON d.id = r.answer_id
SET r.version_no = COALESCE(d.version_no, 0);
ALTER TABLE fm_public_submission DROP PRIMARY KEY, ADD PRIMARY KEY (form_key, session_hash, version_no);
