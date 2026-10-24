-- 003 问卷发布版本快照（M1：不可变版本 + 答案按版本绑定）
-- 仅用于隔离开发库 tduck_vue3_dev；既有答卷内容不变。
USE tduck_vue3_dev;

CREATE TABLE IF NOT EXISTS fm_user_form_version (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_key VARCHAR(64) NOT NULL,
  version_no INT NOT NULL,
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=收集中 2=已停止',
  items_snapshot JSON NOT NULL COMMENT '发布时的题目快照',
  share_token VARCHAR(32) NOT NULL COMMENT '版本分享令牌',
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_form_version (form_key, version_no),
  UNIQUE KEY uk_share_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问卷发布版本快照';

-- 幂等注意：本行由 Apply-VersionMigration.ps1 在列不存在时执行；重复执行 ALTER 会报 Duplicate column。
ALTER TABLE fm_user_form_data ADD COLUMN version_no INT NULL COMMENT '答卷绑定的发布版本号';

-- 存量回填：已收集过答卷且尚无版本的问卷，按当前题目集生成 v1 快照
-- （发布冻结补丁保证了这些问卷发布后题目未再被修改，当前题目即受访者所见题目）。
SET SESSION group_concat_max_len = 67108864;
INSERT INTO fm_user_form_version (form_key, version_no, status, items_snapshot, share_token)
SELECT s.form_key,
       1,
       IF(f.status = 2, 1, 2),
       (SELECT CAST(CONCAT('[', GROUP_CONCAT(
         JSON_OBJECT('id', i.id, 'formKey', i.form_key, 'formItemId', i.form_item_id,
                     'type', i.type, 'label', i.label,
                     'displayType', i.is_display_type, 'hideType', i.is_hide_type,
                     'specialType', i.is_special_type, 'showLabel', i.show_label,
                     'defaultValue', i.default_value, 'required', i.required,
                     'placeholder', i.placeholder, 'sort', i.sort, 'span', i.span,
                     'scheme', i.scheme, 'regList', i.reg_list)
         ORDER BY i.sort SEPARATOR ','), ']') AS JSON)
        FROM fm_user_form_item i WHERE i.form_key = s.form_key),
       SUBSTRING(MD5(CONCAT(s.form_key, UUID())), 1, 24)
FROM (SELECT DISTINCT form_key FROM fm_user_form_data) s
JOIN fm_user_form f ON f.form_key = s.form_key
WHERE NOT EXISTS (SELECT 1 FROM fm_user_form_version v WHERE v.form_key = s.form_key);

-- 存量答卷绑定回填出的 v1
UPDATE fm_user_form_data d
JOIN fm_user_form_version v ON v.form_key = d.form_key AND v.version_no = 1
SET d.version_no = 1
WHERE d.version_no IS NULL;
