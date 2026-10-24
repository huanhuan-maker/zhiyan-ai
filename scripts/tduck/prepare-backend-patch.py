"""Generate a reviewable patch and modify only the private build copy, never the original."""
import difflib
import pathlib
import sys
root = pathlib.Path(sys.argv[1]).resolve()
original = pathlib.Path('D:/tduck-survey-form-master').resolve()
assert root != original and root.name == 'tduck-build' and root.parent.name == '.local'
patch = []
def edit(relative, replacements):
    src = (original / relative).read_text(encoding='utf-8')
    text = src
    for before, after in replacements:
        assert before in text, 'Upstream source mismatch: ' + relative
        text = text.replace(before, after)
    patch.extend(difflib.unified_diff(src.splitlines(True), text.splitlines(True), 'a/'+relative, 'b/'+relative))
    (root / relative).write_text(text, encoding='utf-8')
edit('tduck-common/src/main/java/com/tduck/cloud/common/util/AddressUtils.java', [
    ('        String address = UNKNOWN;', '        if (StrUtil.isBlank(ip)) return UNKNOWN;\n        String address = UNKNOWN;')
])
edit('tduck-form/src/main/java/com/tduck/cloud/form/util/FormDataImportUtils.java', [
    ('import com.tduck.cloud.common.util.SecurityUtils;', 'import com.tduck.cloud.common.util.SecurityUtils;\nimport com.tduck.cloud.common.util.ServletUtils;'),
    ('            entity.setFormKey(formKey);', '            entity.setFormKey(formKey);\n            entity.setSubmitRequestIp(ServletUtils.getRequest().getRemoteAddr());')
])
edit('tduck-form/src/main/java/com/tduck/cloud/form/service/impl/UserFormDataServiceImpl.java', [
    ('        baseMapper.deleteBatchIds(dataIdList);', '''        FormAuthUtils.hasPermission(formKey);
        List<UserFormDataEntity> records = this.listByIds(dataIdList);
        for (UserFormDataEntity record : records) {
            if (!formKey.equals(record.getFormKey())) {
                throw new com.tduck.cloud.common.exception.BaseException("答卷不属于当前问卷");
            }
        }
        baseMapper.deleteBatchIds(dataIdList);'''),
    ('        dataEntity.setOriginalData(entity.getOriginalData());', '''        if (dataEntity == null) {
            throw new com.tduck.cloud.common.exception.BaseException("答卷不存在");
        }
        FormAuthUtils.hasPermission(dataEntity.getFormKey());
        if (!dataEntity.getFormKey().equals(entity.getFormKey())) {
            throw new com.tduck.cloud.common.exception.BaseException("答卷不属于当前问卷");
        }
        dataEntity.setOriginalData(entity.getOriginalData());''')
])
edit('tduck-form/src/main/java/com/tduck/cloud/form/util/FormAuthUtils.java', [
    ('            return;\n        }\n        // 是否是所有者', '            throw new BaseException("问卷不存在");\n        }\n        // 是否是所有者'),
    ('    public void hasPermission(String formKey) {', '''    public void hasEditablePermission(String formKey) {
        hasPermission(formKey);
        UserFormEntity form = SpringContextUtils.getBean(UserFormService.class).getByKey(formKey);
        if (form == null || form.getStatus() != com.tduck.cloud.form.entity.enums.FormStatusEnum.CREATE) {
            throw new BaseException("已发布核心题目已冻结，请复制为新问卷后修改");
        }
    }

    public void hasPermission(String formKey) {''')
])
relative = 'tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserFormController.java'
src = (original / relative).read_text(encoding='utf-8')
modified = src.replace('            form.setId(oldForm.getId());', '            form.setId(oldForm.getId());\n            form.setStatus(oldForm.getStatus());\n            form.setUserId(oldForm.getUserId());')
for method, variable in [('createFormItem','entity'), ('updateFormItem','request'), ('deleteFormItem','request'), ('sortFormItem','request')]:
    start = modified.index('public Result '+method+'(')
    end = modified.index('\n    }', start)
    section = modified[start:end]
    before = 'FormAuthUtils.hasPermission('+variable+'.getFormKey());'
    assert before in section
    modified = modified[:start]+section.replace(before, 'FormAuthUtils.hasEditablePermission('+variable+'.getFormKey());')+modified[end:]
before = '            FormAuthUtils.hasPermission(itemEntityList.get(0).getFormKey());'
assert before in modified
modified = modified.replace(before, '            itemEntityList.forEach(item -> FormAuthUtils.hasEditablePermission(item.getFormKey()));')
patch.extend(difflib.unified_diff(src.splitlines(True), modified.splitlines(True), 'a/'+relative, 'b/'+relative))
(root / relative).write_text(modified, encoding='utf-8')
edit('tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserFormResultController.java', [
    ('public Result createFormResult(@RequestBody UserFormDataEntity entity, HttpServletRequest request) {', 'public Result createFormResult(@RequestBody UserFormDataEntity entity, HttpServletRequest request) {\n        FormAuthUtils.hasPermission(entity.getFormKey());'),
    ('        Result<Boolean> userFormSettingStatus =', '''        FormSettingSchemaStruct settings = userFormSettingService.getFormSettingSchema(entity.getFormKey());
        if (settings != null && settings.isPasswordWriteStatus()
                && !StrUtil.equals(settings.getWritePassword(), request.getHeader("X-Form-Password"))) {
            return Result.failed("请输入正确的填写密码");
        }
        Result<Boolean> userFormSettingStatus =''')
])
out = pathlib.Path('patches/tduck-backend')
out.mkdir(parents=True, exist_ok=True)
(out/'local-acceptance-fixes.patch').write_text(''.join(patch), encoding='utf-8')
(out/'LICENSE').write_text((original/'LICENSE').read_text(encoding='utf-8'), encoding='utf-8')
print('Generated patch for 6 backend files; original source was read only.')
