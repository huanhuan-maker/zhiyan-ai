package com.tduck.cloud.form.assistant;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.analysis.AnalysisSnapshotService;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.entity.enums.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.service.*;
import com.tduck.cloud.form.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Management tools prepare proposals; only the authenticated confirmation endpoint applies them. */
@Service @RequiredArgsConstructor
public class AssistantWorkspace {
    private final UserFormMapper forms;
    private final UserFormItemMapper items;
    private final UserFormDataMapper answers;
    private final UserFormVersionService versions;
    private final AiDraftService designer;
    private final UserFormThemeService themes;
    private final UserFormLogicService logics;
    private final UserFormSettingService settings;
    public static final Set<String> ACTIONS=new HashSet<>(Arrays.asList("CREATE","RENAME","DESCRIBE","REPLACE_QUESTIONS","ADD_QUESTION","EDIT_QUESTION","REMOVE_QUESTION","MOVE_QUESTION","COPY","PUBLISH","STOP","ARCHIVE"));

    private UserFormEntity owned(String key,Long owner) {
        UserFormEntity f=forms.selectOne(Wrappers.<UserFormEntity>lambdaQuery().eq(UserFormEntity::getFormKey,key));
        if(f==null||!Objects.equals(owner,f.getUserId())||Boolean.TRUE.equals(f.getDeleted())||Boolean.TRUE.equals(f.getFolder()))throw new BaseException("问卷不存在或无权操作");return f;
    }
    private List<UserFormItemEntity> fields(String key){return items.selectList(Wrappers.<UserFormItemEntity>lambdaQuery().eq(UserFormItemEntity::getFormKey,key).orderByAsc(UserFormItemEntity::getSort));}
    public static String text(Object value,int max,String label) {
        if(!(value instanceof String)||((String)value).trim().isEmpty()||((String)value).length()>max)throw new BaseException(label+"不能为空且不超过"+max+"字");
        String clean=HtmlUtils.cleanHtmlTag((String)value).trim();if(clean.isEmpty())throw new BaseException(label+"不能为空");return clean;
    }
    public static void validate(Map<String,Object> args) {
        String action=String.valueOf(args.get("action"));if(!ACTIONS.contains(action))throw new BaseException("不支持此问卷操作");
        Set<String> allowed=new HashSet<>(Arrays.asList("action","formKey"));
        if(Arrays.asList("CREATE","COPY","RENAME").contains(action)){allowed.add("title");if(!"COPY".equals(action)||args.containsKey("title"))text(args.get("title"),100,"标题");}
        if(Arrays.asList("CREATE","DESCRIBE").contains(action)){allowed.add("description");if(args.containsKey("description")){if(!(args.get("description") instanceof String)||((String)args.get("description")).length()>2000)throw new BaseException("简介不超过2000字");}else if("DESCRIBE".equals(action))throw new BaseException("请提供简介");}
        if(Arrays.asList("CREATE","REPLACE_QUESTIONS").contains(action)){allowed.add("questions");if(args.containsKey("questions"))normalizedQuestions(args.get("questions"));else if("REPLACE_QUESTIONS".equals(action))throw new BaseException("请提供完整题目列表");}
        if(Arrays.asList("EDIT_QUESTION","REMOVE_QUESTION","MOVE_QUESTION").contains(action)){allowed.add("questionNo");AssistantTools.integer(args.get("questionNo"),1,200,"题号");}
        if("MOVE_QUESTION".equals(action)){allowed.add("toPosition");AssistantTools.integer(args.get("toPosition"),1,200,"目标题号");}
        if(Arrays.asList("ADD_QUESTION","EDIT_QUESTION").contains(action)){
            allowed.add("question");if(!(args.get("question") instanceof Map)||((Map<?,?>)args.get("question")).isEmpty())throw new BaseException("请提供题目内容");
            if(!new HashSet<>(Arrays.asList("type","label","required","options","rateMax","placeholder")).containsAll(((Map<?,?>)args.get("question")).keySet()))throw new BaseException("题目包含不支持的字段");
            if("ADD_QUESTION".equals(action))normalizedQuestions(Collections.singletonList(args.get("question")));
        }
        if(!allowed.containsAll(args.keySet()))throw new BaseException("操作包含不支持的字段");
        if(!"CREATE".equals(action)&&(!(args.get("formKey") instanceof String)||!((String)args.get("formKey")).matches("[A-Za-z0-9_-]{1,64}")))throw new BaseException("请先选择问卷");
        if("CREATE".equals(action)&&args.containsKey("formKey"))throw new BaseException("新建操作不能指定已有问卷");
    }
    public static List<Map<String,Object>> normalizedQuestions(Object raw) {
        if(!(raw instanceof List)||((List<?>)raw).isEmpty()||((List<?>)raw).size()>AiDraftValidator.MAX_QUESTIONS)throw new BaseException("题目数量需为1-"+AiDraftValidator.MAX_QUESTIONS+"");
        List<Map<String,Object>> out=new ArrayList<>();Set<String> labels=new HashSet<>();
        for(Object entry:(List<?>)raw){
            if(!(entry instanceof Map))throw new BaseException("题目格式不正确");Map<?,?> q=(Map<?,?>)entry;
            if(!new HashSet<>(Arrays.asList("type","label","required","options","rateMax","placeholder")).containsAll(q.keySet()))throw new BaseException("题目包含不支持的字段");
            String type=String.valueOf(q.get("type"));if("TEXT".equals(type))type="TEXTAREA";
            if(!Arrays.asList("RADIO","CHECKBOX","RATE","TEXTAREA","INPUT").contains(type))throw new BaseException("聊天编辑支持单选、多选、评分和文本题，其他组件请在编辑器配置");
            String label=text(q.get("label"),200,"题干");if(!labels.add(label))throw new BaseException("题干重复");
            if(q.containsKey("required")&&!(q.get("required") instanceof Boolean))throw new BaseException("必填标记格式不正确");
            Map<String,Object> n=map("type",type,"label",label,"required",!Boolean.FALSE.equals(q.get("required")));
            if(Arrays.asList("RADIO","CHECKBOX").contains(type)){
                if(!(q.get("options") instanceof List))throw new BaseException("请提供选项");List<?> opts=(List<?>)q.get("options");
                if(opts.size()<2||opts.size()>20)throw new BaseException("选项数量需为2-20");List<String> values=new ArrayList<>();for(Object o:opts)values.add(text(o,200,"选项"));
                if(new HashSet<>(values).size()!=values.size())throw new BaseException("选项重复");n.put("options",values);
            }
            if("RATE".equals(type))n.put("rateMax",q.containsKey("rateMax")?AssistantTools.integer(q.get("rateMax"),2,10,"评分上限"):5);
            if(q.containsKey("placeholder"))n.put("placeholder",text(q.get("placeholder"),200,"提示文字"));out.add(n);
        }return out;
    }
    public String fingerprint(String key,Long owner) {
        UserFormEntity f=owned(key,owner);
        // Include all copied configuration and version status so a stale preview cannot overwrite newer work.
        return AnalysisSnapshotService.fingerprint(cn.hutool.json.JSONUtil.toJsonStr(map("name",f.getName(),"description",f.getDescription(),"status",f.getStatus(),"items",fields(key),
            "versions",versions.listByForm(key),"theme",themes.getByKey(key),"logic",logics.list(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key)),
            "settings",settings.list(Wrappers.<UserFormSettingEntity>lambdaQuery().eq(UserFormSettingEntity::getFormKey,key)))));
    }
    public Map<String,Object> propose(Map<String,Object> supplied,Long owner) {
        validate(supplied);Map<String,Object> args=new LinkedHashMap<>(supplied);String action=(String)args.get("action"),key=(String)args.get("formKey");
        if(args.containsKey("title"))args.put("title",text(args.get("title"),100,"标题"));
        if(args.containsKey("description"))args.put("description",HtmlUtils.cleanHtmlTag((String)args.get("description")));
        if(args.containsKey("questions"))args.put("questions",normalizedQuestions(args.get("questions")));
        UserFormEntity f=key==null?null:owned(key,owner);checkState(action,f);
        List<String> changedFields=new ArrayList<>();
        if(Arrays.asList("EDIT_QUESTION","REMOVE_QUESTION","MOVE_QUESTION").contains(action)){
            List<UserFormItemEntity> current=fields(key);int index=((Number)args.get("questionNo")).intValue()-1;
            if(index>=current.size())throw new BaseException("题号不存在");
            if("MOVE_QUESTION".equals(action)&&((Number)args.get("toPosition")).intValue()>current.size())throw new BaseException("目标题号不存在");
            if("EDIT_QUESTION".equals(action)){
                changedFields.addAll(((Map<String,Object>)args.get("question")).keySet());
                if(changedFields.contains("options")&&!logics.list(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key)).isEmpty())throw new BaseException("此问卷配置了跳转逻辑，修改选项请到编辑器核对逻辑关联");
                args.put("question",mergedQuestion(current.get(index),(Map<String,Object>)args.get("question")));
            }
            if("REMOVE_QUESTION".equals(action)&&!logics.list(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key)).isEmpty())throw new BaseException("此问卷配置了跳转逻辑，请先在编辑器核对并移除相关逻辑再删除题目");
        }
        if("ADD_QUESTION".equals(action)){if(fields(key).size()>=200)throw new BaseException("当前问卷题目已达聊天管理上限");args.put("question",normalizedQuestions(Collections.singletonList(args.get("question"))).get(0));}
        List<Map<String,Object>> before=key==null?Collections.emptyList():fields(key).stream().map(i->map("label",i.getTextLabel(),"type",i.getType(),"required",i.getRequired())).collect(Collectors.toList());
        String effect;
        switch(action){
            case "CREATE":effect="新建草稿，不会自动发布";break;
            case "RENAME":effect="更新草稿标题；已有发布版本标题保持原样";break;
            case "DESCRIBE":effect="更新草稿简介；已有发布版本简介保持原样";break;
            case "REPLACE_QUESTIONS":effect="用预览题目替换当前草稿全部题目并清除原跳转逻辑；已发布快照与历史答卷保留";break;
            case "ADD_QUESTION":effect="在当前草稿末尾新增一道题目";break;
            case "EDIT_QUESTION":effect="修改草稿第"+args.get("questionNo")+"题，其他题目保留";break;
            case "REMOVE_QUESTION":effect="删除草稿第"+args.get("questionNo")+"题，已发布版本与历史答卷保留";break;
            case "MOVE_QUESTION":effect="将草稿第"+args.get("questionNo")+"题移动到第"+args.get("toPosition")+"题";break;
            case "COPY":effect="复制当前草稿题目、主题、逻辑和设置；不复制答卷、发布版本或分享令牌";break;
            case "PUBLISH":effect="冻结当前草稿生成新发布版本，并开放收集";break;
            case "STOP":effect="停止当前版本收集，分享链接将不能再提交";break;
            default:effect="移入回收站并停止收集，保留历史答卷与版本；不永久删除数据";
        }
        return map("kind","action_proposal","message","请核对操作内容，确认后才会执行。","action",action,"title",f==null?args.get("title"):f.getTextName(),"formKey",key,
            "effect",effect,"before",map("title",f==null?null:f.getTextName(),"description",f==null?null:HtmlUtils.cleanHtmlTag(f.getDescription()),"questions",before),
            "arguments",args,"changedFields",changedFields,"fingerprint",key==null?null:fingerprint(key,owner),"expiresAt",Instant.now().plusSeconds(1800).toString(),"citations",Collections.emptyList());
    }
    private void checkState(String action,UserFormEntity f) {
        if(f==null)return;
        boolean open=versions.openVersion(f.getFormKey())!=null;
        if(Arrays.asList("RENAME","DESCRIBE","REPLACE_QUESTIONS","ADD_QUESTION","EDIT_QUESTION","REMOVE_QUESTION","MOVE_QUESTION").contains(action)&&open)throw new BaseException("问卷正在收集中，请先停止收集或复制为新草稿再编辑；已发布核心题不能修改");
        if("PUBLISH".equals(action)){if(open)throw new BaseException("问卷已在收集中，无需重复发布");if(fields(f.getFormKey()).isEmpty())throw new BaseException("请先添加题目再发布");}
        if("STOP".equals(action)&&!open)throw new BaseException("这份问卷没有正在收集的版本");
    }
    public Map<String,Object> design(Map<String,Object> args,Long owner) {
        AiDraftInput input=new AiDraftInput();input.setGoal((String)args.get("goal"));input.setAudience((String)args.getOrDefault("audience","调查对象"));input.setQuestionCount(args.containsKey("questionCount")?((Number)args.get("questionCount")).intValue():6);input.setExtra("");
        Map<String,Object> draft=designer.generate(input);
        if("clarification".equals(draft.get("kind")))return map("kind","notice","message",String.join("\n",(List<String>)draft.get("clarification")),"citations",Collections.emptyList());
        // The validator emits an empty placeholder; omit it before applying the strict management schema.
        List<Map<String,Object>> questions=(List<Map<String,Object>>)draft.get("questions");questions.forEach(q->{if("".equals(q.get("placeholder")))q.remove("placeholder");});
        Map<String,Object> p=propose(map("action","CREATE","title",draft.get("title"),"description",draft.get("description"),"questions",questions),owner);
        p.put("generation",map("mode",draft.get("mode"),"provider",draft.get("provider"),"model",draft.get("model"),"warnings",draft.get("warnings")));return p;
    }
    public Map<String,Object> details(String key,Integer number,Long owner) {
        UserFormEntity f=owned(key,owner);UserFormVersionEntity v=number==null?null:versions.byNo(key,number);
        if(number!=null&&v==null)throw new BaseException("版本不存在");
        List<UserFormItemEntity> list=v==null?fields(key):versions.itemsOf(v);
        return map("kind","details","message",number==null?"当前草稿内容如下，发布版本另行冻结保存。":"以下为不可变发布版本。","formKey",key,"version",number,"title",v==null?f.getTextName():HtmlUtils.cleanHtmlTag(String.valueOf(v.getFormSnapshot().get("name"))),
            "description",v==null?HtmlUtils.cleanHtmlTag(f.getDescription()):HtmlUtils.cleanHtmlTag(String.valueOf(v.getFormSnapshot().getOrDefault("description",""))),"status",f.getStatus().getDesc(),
            "questions",list.stream().map(i->map("id",i.getFormItemId(),"label",i.getTextLabel(),"type",i.getType(),"required",i.getRequired(),"scheme",i.getScheme())).collect(Collectors.toList()),"citations",Collections.emptyList());
    }
    public Map<String,Object> versionList(String key,Long owner) {
        UserFormEntity f=owned(key,owner);List<Map<String,Object>> rows=new ArrayList<>();
        for(UserFormVersionEntity v:versions.listByForm(key))rows.add(map("versionNo",v.getVersionNo(),"status",v.getStatus(),"answerCount",answers.selectCount(Wrappers.<UserFormDataEntity>lambdaQuery().eq(UserFormDataEntity::getFormKey,key).eq(UserFormDataEntity::getVersionNo,v.getVersionNo())),"createdAt",String.valueOf(v.getCreateTime())));
        return map("kind","versions","message","共找到"+rows.size()+"个发布版本。","formKey",key,"title",f.getTextName(),"versions",rows,"citations",Collections.emptyList());
    }
    public Map<String,Object> share(String key,Integer number,Long owner) {
        owned(key,owner);UserFormVersionEntity v=number==null?versions.latest(key):versions.byNo(key,number);if(v==null)throw new AssistantTools.UnpublishedSurvey();
        return map("kind","share","message",Objects.equals(UserFormVersionEntity.STATUS_OPEN,v.getStatus())?"此版本正在收集，可复制链接分享。":"此版本已停止收集，链接仅可查看。","formKey",key,"version",v.getVersionNo(),"sharePath","/s/"+key+"?t="+v.getShareToken(),"citations",Collections.emptyList());
    }
    public Map<String,Object> export(String key,Integer number,Long owner) {
        owned(key,owner);UserFormVersionEntity v=number==null?versions.latest(key):versions.byNo(key,number);if(v==null)throw new AssistantTools.UnpublishedSurvey();
        List<UserFormDataEntity> rows=answers.selectList(Wrappers.<UserFormDataEntity>lambdaQuery().eq(UserFormDataEntity::getFormKey,key).eq(UserFormDataEntity::getVersionNo,v.getVersionNo()).orderByAsc(UserFormDataEntity::getId).last("limit 5001"));
        if(rows.size()>5000)throw new BaseException("聊天导出单版本上限5000份，请使用数据管理页导出");
        List<UserFormItemEntity> fs=versions.itemsOf(v).stream().filter(i->!Boolean.TRUE.equals(i.getDisplayType())).collect(Collectors.toList());
        List<List<Object>> data=new ArrayList<>();for(UserFormDataEntity r:rows){List<Object> line=new ArrayList<>();line.add(data.size()+1);for(UserFormItemEntity f:fs)line.add(r.getOriginalData()==null?null:r.getOriginalData().get(f.getFormItemId()));data.add(line);}
        List<String> headers=new ArrayList<>();headers.add("导出序号");fs.forEach(f->headers.add(f.getTextLabel()));
        return map("kind","export","message","已准备该版本的全部"+data.size()+"份答卷，未包含IP、设备及账号字段。文件在本机下载，原文未发送给模型。","formKey",key,"version",v.getVersionNo(),"headers",headers,"rows",data,"citations",Collections.emptyList());
    }
    public Map<String,Object> apply(Map<String,Object> proposal,Long owner) {
        if(Instant.parse((String)proposal.get("expiresAt")).isBefore(Instant.now()))throw new BaseException("操作预览已过期，请重新提问");
        Map<String,Object> args=(Map<String,Object>)proposal.get("arguments");validate(args);String action=(String)args.get("action"),key=(String)args.get("formKey");
        UserFormEntity f=key==null?null:owned(key,owner);
        if(key!=null&&!Objects.equals(proposal.get("fingerprint"),fingerprint(key,owner)))throw new BaseException("问卷内容或状态已变化，请重新生成操作预览");checkState(action,f);
        if("CREATE".equals(action)||"COPY".equals(action)){
            UserFormEntity n=new UserFormEntity();n.setFormKey(ShortIdUtils.genId());n.setUserId(owner);n.setName((String)args.getOrDefault("title",f==null?"新问卷":f.getTextName()+"（副本）"));n.setDescription((String)args.getOrDefault("description",f==null?"":f.getDescription()));
            n.setType(f==null?FormTypeEnum.ORDINARY:f.getType());n.setFolder(false);n.setFolderId(0L);n.setDeleted(false);n.setStatus(FormStatusEnum.CREATE);n.setSourceType(FormSourceTypeEnum.BLANK);forms.insert(n);
            if("COPY".equals(action)){
                for(UserFormItemEntity i:fields(key)){i.setId(null);i.setCreateTime(null);i.setUpdateTime(null);i.setFormKey(n.getFormKey());items.insert(i);}
                UserFormThemeEntity theme=themes.getByKey(key);if(theme!=null){theme.setId(null);theme.setCreateTime(null);theme.setUpdateTime(null);theme.setFormKey(n.getFormKey());themes.save(theme);}
                for(UserFormLogicEntity l:logics.list(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key))){l.setId(null);l.setCreateTime(null);l.setUpdateTime(null);l.setFormKey(n.getFormKey());logics.save(l);}
                for(UserFormSettingEntity s:settings.list(Wrappers.<UserFormSettingEntity>lambdaQuery().eq(UserFormSettingEntity::getFormKey,key))){s.setId(null);s.setCreateTime(null);s.setUpdateTime(null);s.setFormKey(n.getFormKey());settings.save(s);}
            }else if(args.containsKey("questions"))insertQuestions(n.getFormKey(),normalizedQuestions(args.get("questions")));
            f=n;key=n.getFormKey();
        }else if("RENAME".equals(action)){f.setName((String)args.get("title"));forms.updateById(f);}
        else if("DESCRIBE".equals(action)){f.setDescription((String)args.get("description"));forms.updateById(f);}
        else if("REPLACE_QUESTIONS".equals(action)){items.delete(Wrappers.<UserFormItemEntity>lambdaQuery().eq(UserFormItemEntity::getFormKey,key));logics.remove(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key));insertQuestions(key,normalizedQuestions(args.get("questions")));}
        else if("ADD_QUESTION".equals(action)){
            List<UserFormItemEntity> current=fields(key);insertQuestions(key,Collections.singletonList((Map<String,Object>)args.get("question")),current.isEmpty()?0:current.stream().mapToLong(i->i.getSort()==null?0:i.getSort()).max().getAsLong());
        }
        else if("EDIT_QUESTION".equals(action)){
            UserFormItemEntity i=fields(key).get(((Number)args.get("questionNo")).intValue()-1);Map<String,Object> q=(Map<String,Object>)args.get("question");
            Map<String,Object> merged=mergedQuestion(i,q);if(!i.getType().name().equals(merged.get("type")))throw new BaseException("聊天修改暂不支持切换已有题型，请在编辑器操作");
            Map<String,Object> config=(Map<String,Object>)i.getScheme().get("config");i.setLabel((String)merged.get("label"));i.setRequired((Boolean)merged.get("required"));config.put("label",i.getLabel());config.put("required",i.getRequired());
            if(((List<?>)proposal.getOrDefault("changedFields",Collections.emptyList())).contains("options")){
                List<Map<String,Object>> previous=(List<Map<String,Object>>)config.getOrDefault("options",Collections.emptyList()),opts=new ArrayList<>();
                for(Object value:(List<?>)merged.get("options")){int pos=opts.size();Map<String,Object> opt=pos<previous.size()?new LinkedHashMap<>(previous.get(pos)):map("value",UUID.randomUUID().toString(),"quotaSetting",null);opt.put("label",value);opts.add(opt);}config.put("options",opts);
            }
            if(merged.containsKey("rateMax"))i.getScheme().put("max",merged.get("rateMax"));if(merged.containsKey("placeholder"))i.setPlaceholder((String)merged.get("placeholder"));items.updateById(i);
        }
        else if("REMOVE_QUESTION".equals(action)){
            if(!logics.list(Wrappers.<UserFormLogicEntity>lambdaQuery().eq(UserFormLogicEntity::getFormKey,key)).isEmpty())throw new BaseException("问卷逻辑已变化，请在编辑器操作");items.deleteById(fields(key).get(((Number)args.get("questionNo")).intValue()-1).getId());
        }
        else if("MOVE_QUESTION".equals(action)){List<UserFormItemEntity> current=fields(key);UserFormItemEntity moved=current.remove(((Number)args.get("questionNo")).intValue()-1);current.add(((Number)args.get("toPosition")).intValue()-1,moved);for(int pos=0;pos<current.size();pos++){current.get(pos).setSort((long)(pos+1)*1024);items.updateById(current.get(pos));}}
        else if("PUBLISH".equals(action)){versions.publishSnapshot(key);f.setStatus(FormStatusEnum.RELEASE);forms.updateById(f);}
        else if("STOP".equals(action)||"ARCHIVE".equals(action)){versions.closeOpen(key);f.setStatus(FormStatusEnum.STOP);if("ARCHIVE".equals(action))f.setDeleted(true);forms.updateById(f);}
        Map<String,Object> result=map("kind","action_result","message","操作已完成："+proposal.get("effect"),"action",action,"formKey",key,"title",f.getTextName(),"asOf",Instant.now().toString(),"citations",Collections.emptyList());
        if("PUBLISH".equals(action))result.putAll(share(key,null,owner));result.put("kind","action_result");return result;
    }
    private Map<String,Object> mergedQuestion(UserFormItemEntity field,Map<String,Object> changes) {
        if(field.getScheme()==null||!(field.getScheme().get("config") instanceof Map))throw new BaseException("此题配置需在编辑器处理");
        Map<String,Object> q=map("type",field.getType().name(),"label",field.getTextLabel(),"required",field.getRequired());Map<?,?> config=(Map<?,?>)field.getScheme().get("config");
        if(config.get("options") instanceof List)q.put("options",((List<Map<String,Object>>)config.get("options")).stream().map(o->o.get("label")).collect(Collectors.toList()));
        if(field.getScheme().get("max") instanceof Number&&field.getType()==FormItemTypeEnum.RATE)q.put("rateMax",field.getScheme().get("max"));
        if(field.getPlaceholder()!=null&&!field.getPlaceholder().isEmpty())q.put("placeholder",field.getPlaceholder());q.putAll(changes);
        Map<String,Object> normalized=normalizedQuestions(Collections.singletonList(q)).get(0);
        if(!field.getType().name().equals(normalized.get("type")))throw new BaseException("切换已有题型请在编辑器操作");return normalized;
    }
    private void insertQuestions(String key,List<Map<String,Object>> qs){insertQuestions(key,qs,0);}
    private void insertQuestions(String key,List<Map<String,Object>> qs,long start) {
        int order=0;for(Map<String,Object> q:qs){String type=(String)q.get("type"),id=type+"_"+UUID.randomUUID().toString().replace("-","");
            Map<String,Object> config=map("formId",id,"label",q.get("label"),"required",q.get("required"),"span",24,"showLabel",true,"regList",Collections.emptyList(),"defaultValue","CHECKBOX".equals(type)?Collections.emptyList():null,"optionsType",0,"optionType","default","inline",false);
            Map<String,Object> scheme=map("typeId",type,"vModel",id,"config",config,"style",map(),"disabled",false);
            if(q.get("options") instanceof List){List<Map<String,Object>> opts=new ArrayList<>();for(Object value:(List<?>)q.get("options"))opts.add(map("label",value,"value",opts.size()+1,"quotaSetting",null));config.put("options",opts);}
            if("RATE".equals(type)){scheme.put("max",q.get("rateMax"));scheme.put("allow-half",false);}
            UserFormItemEntity i=new UserFormItemEntity().setFormKey(key).setFormItemId(id).setType(FormItemTypeEnum.valueOf(type)).setLabel((String)q.get("label"))
                .setRequired((Boolean)q.get("required")).setSort(start+(long)++order*1024).setSpan(24).setShowLabel(true).setDisplayType(false).setHideType(false).setSpecialType(false).setScheme(scheme).setRegList(Collections.emptyList());
            if(q.containsKey("placeholder"))i.setPlaceholder((String)q.get("placeholder"));items.insert(i);
        }
    }
}
