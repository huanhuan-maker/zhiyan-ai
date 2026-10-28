package com.tduck.cloud.form.assistant;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.analysis.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.service.UserFormVersionService;
import com.tduck.cloud.form.util.HtmlUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Owner-scoped read tools. No arbitrary SQL, cross-owner admin override, or model-generated facts. */
@Service @RequiredArgsConstructor
public class AssistantTools {
    private final UserFormMapper forms;
    private final UserFormDataMapper answers;
    private final UserFormVersionService versions;
    private final AnalysisSnapshotService snapshots;
    private final AnalysisReportMapper reports;
    @org.springframework.beans.factory.annotation.Autowired private AssistantWorkspace workspace;
    @org.springframework.beans.factory.annotation.Autowired private SurveyKnowledgeService knowledge;
    public static class UnpublishedSurvey extends BaseException {public UnpublishedSurvey(){super("问卷尚未发布，暂无发布版本统计");}}

    public UserFormEntity requireOwned(String key,Long owner) {
        if(key==null||!key.matches("[A-Za-z0-9_-]{1,64}")) throw new BaseException("请先选择自己的问卷");
        UserFormEntity form=forms.selectOne(Wrappers.<UserFormEntity>lambdaQuery().eq(UserFormEntity::getFormKey,key));
        if(form==null||!Objects.equals(owner,form.getUserId())||Boolean.TRUE.equals(form.getDeleted())||Boolean.TRUE.equals(form.getFolder())) throw new BaseException("问卷不存在、已归档或不属于当前账号");
        return form;
    }
    private UserFormVersionEntity resolve(String key,Object requested) {
        Integer number=requested==null?null:integer(requested,1,100000,"版本");
        UserFormVersionEntity version=number==null?versions.latest(key):versions.byNo(key,number);
        if(version==null){if(number==null)throw new UnpublishedSurvey();throw new BaseException("问卷尚未发布或该版本不存在，请选择已发布版本");}return version;
    }
    public static int integer(Object value,int min,int max,String name) {
        if(!(value instanceof Number)||((Number)value).doubleValue()!=((Number)value).intValue()) throw new BaseException(name+"必须是整数");
        int n=((Number)value).intValue();if(n<min||n>max)throw new BaseException(name+"超出允许范围");return n;
    }
    private static String str(Object value,int max,String name) {
        if(!(value instanceof String)||((String)value).length()>max)throw new BaseException(name+"格式或长度不正确");return ((String)value).trim();
    }
    public static Set<String> argumentsFor(String tool) {
        switch(tool) {
            case "survey_knowledge":return new HashSet<>(Arrays.asList("formKey","version","question"));
            case "search_surveys":return new HashSet<>(Arrays.asList("query","limit","status","fromDate","untilDate"));
            case "survey_stats":return new HashSet<>(Arrays.asList("formKey","version","chartType","fieldQuery"));
            case "survey_report":return new HashSet<>(Arrays.asList("formKey","version"));
            case "survey_details":case "survey_share":case "survey_export":return new HashSet<>(Arrays.asList("formKey","version"));
            case "survey_versions":return Collections.singleton("formKey");
            case "manage_survey":return new HashSet<>(Arrays.asList("formKey","action","title","description","questions","question","questionNo","toPosition"));
            case "design_survey":return new HashSet<>(Arrays.asList("goal","audience","questionCount"));
            case "search_answers":return new HashSet<>(Arrays.asList("formKey","version","keywords","fieldId","limit"));
            default:throw new BaseException("工具不在问卷助手的授权范围内");
        }
    }
    public static void validateArguments(String tool,Map<String,Object> args) {
        if(args==null||!argumentsFor(tool).containsAll(args.keySet()))throw new BaseException("工具参数不在允许范围内");
        if("manage_survey".equals(tool)){AssistantWorkspace.validate(args);return;}
        if("design_survey".equals(tool)){str(args.get("goal"),500,"调查目标");if(((String)args.get("goal")).trim().isEmpty())throw new BaseException("调查目标不能为空");if(args.containsKey("audience"))str(args.get("audience"),100,"调查对象");if(args.containsKey("questionCount"))integer(args.get("questionCount"),1,com.tduck.cloud.form.ai.AiDraftValidator.MAX_QUESTIONS,"题数");return;}
        if(!"search_surveys".equals(tool)&&(!(args.get("formKey") instanceof String)||!((String)args.get("formKey")).matches("[A-Za-z0-9_-]{1,64}")))throw new BaseException("请先选择问卷");
        if(args.containsKey("version"))integer(args.get("version"),1,100000,"版本");
        if("survey_knowledge".equals(tool)&&str(args.get("question"),1000,"分析问题").isEmpty())throw new BaseException("分析问题不能为空");
        if(args.containsKey("limit"))integer(args.get("limit"),1,10,"条数");
        if(args.containsKey("status"))integer(args.get("status"),1,3,"状态");
        if(args.containsKey("query"))str(args.get("query"),100,"搜索词");
        if(args.containsKey("fieldId"))str(args.get("fieldId"),100,"题目编号");
        if(args.containsKey("fieldQuery"))str(args.get("fieldQuery"),100,"题目名称");
        if(args.containsKey("chartType")&&!Arrays.asList("all","bar","donut","line").contains(args.get("chartType")))throw new BaseException("图表类型不支持");
        for(String date:Arrays.asList("fromDate","untilDate"))if(args.containsKey(date))try{LocalDate.parse(str(args.get(date),10,"日期"));}catch(Exception e){throw new BaseException("日期必须为YYYY-MM-DD");}
        if("search_answers".equals(tool)) {
            if(!(args.get("keywords") instanceof List))throw new BaseException("请提供关键词列表");
            List<?> terms=(List<?>)args.get("keywords");if(terms.isEmpty()||terms.size()>6)throw new BaseException("关键词需要1-6项");
            for(Object term:terms)if(str(term,30,"关键词").isEmpty())throw new BaseException("关键词不能为空");
        }
    }
    public static Map<String,Object> normalizedArguments(String tool,Map<String,Object> args) {
        validateArguments(tool,args);Map<String,Object> normalized=new LinkedHashMap<>(args);
        for(String numeric:Arrays.asList("version","limit","status","questionCount","questionNo","toPosition"))if(normalized.get(numeric)!=null)normalized.put(numeric,((Number)normalized.get(numeric)).intValue());
        return normalized;
    }
    @Transactional
    public Map<String,Object> call(String tool,Map<String,Object> args,Long owner) {
        validateArguments(tool,args);
        Map<String,Object> result;
        if("survey_knowledge".equals(tool))result=knowledge.answer((String)args.get("formKey"),(Integer)args.get("version"),(String)args.get("question"),owner);
        else if("manage_survey".equals(tool))result=workspace.propose(args,owner);
        else if("design_survey".equals(tool))result=workspace.design(args,owner);
        else if("survey_details".equals(tool))result=workspace.details((String)args.get("formKey"),(Integer)args.get("version"),owner);
        else if("survey_versions".equals(tool))result=workspace.versionList((String)args.get("formKey"),owner);
        else if("survey_share".equals(tool))result=workspace.share((String)args.get("formKey"),(Integer)args.get("version"),owner);
        else if("survey_export".equals(tool))result=workspace.export((String)args.get("formKey"),(Integer)args.get("version"),owner);
        else if("search_surveys".equals(tool)) result=search(args,owner);
        else {
            String key=(String)args.get("formKey");UserFormEntity selected=requireOwned(key,owner);
            UserFormVersionEntity version=resolve(key,args.get("version"));
            if("survey_stats".equals(tool)){result=stats(key,version);result.put("chartRequest",map("chartType",args.getOrDefault("chartType","all"),"fieldQuery",args.getOrDefault("fieldQuery","")));}
            else if("search_answers".equals(tool))result=evidence(key,version,args);
            else result=report(key,version);
            result.put("formKey",key);result.put("version",version.getVersionNo());
            if(!result.containsKey("title"))result.put("title",selected.getTextName());
            result.put("sourceUrl","/project/form/statistics?key="+key+"&version="+version.getVersionNo());
        }
        result.put("asOf",Instant.now().toString());result.put("tool",tool);return result;
    }
    public List<Map<String,Object>> versionChoices(String key,Long owner) {
        requireOwned(key,owner);return versions.listByForm(key).stream().map(v->map("versionNo",v.getVersionNo(),"status",v.getStatus())).collect(Collectors.toList());
    }
    private Map<String,Object> search(Map<String,Object> args,Long owner) {
        String query=args.containsKey("query")?str(args.get("query"),100,"搜索词"):"";
        LambdaQueryWrapper<UserFormEntity> w=Wrappers.<UserFormEntity>lambdaQuery().eq(UserFormEntity::getUserId,owner).eq(UserFormEntity::getDeleted,false).eq(UserFormEntity::getFolder,false);
        if(!query.isEmpty())w.like(UserFormEntity::getName,query);
        if(args.get("status")!=null)w.apply("status = {0}",args.get("status"));
        if(args.get("fromDate")!=null)w.ge(UserFormEntity::getCreateTime,LocalDate.parse((String)args.get("fromDate")).atStartOfDay());
        if(args.get("untilDate")!=null)w.lt(UserFormEntity::getCreateTime,LocalDate.parse((String)args.get("untilDate")).plusDays(1).atStartOfDay());
        long count=forms.selectCount(w);int limit=args.containsKey("limit")?integer(args.get("limit"),1,10,"条数"):6;
        List<Map<String,Object>> found=forms.selectList(w.orderByDesc(UserFormEntity::getCreateTime).last("limit "+limit)).stream()
            .map(f->map("formKey",f.getFormKey(),"title",f.getTextName(),"status",f.getStatus()==null?null:f.getStatus().getDesc(),"createdAt",String.valueOf(f.getCreateTime()),"sourceUrl","/project/form/editor?key="+f.getFormKey())).collect(Collectors.toList());
        return map("kind","surveys","message","在当前账号可访问的问卷中找到 "+count+" 份，展示前 "+found.size()+" 份。请选择一份后继续查询。","total",count,"query",query,"surveys",found,"citations",Collections.emptyList(),"dateBasis","问卷创建时间，服务端数据库日期");
    }
    private Map<String,Object> stats(String key,UserFormVersionEntity v) {
        Map<String,Object> snap=snapshots.capture(key,v.getVersionNo());
        List<Map<String,Object>> data=JSON.convertValue(snap.get("statistics"),List.class);data.forEach(q->q.remove("responses"));
        return map("kind","statistics","message","V"+v.getVersionNo()+" 共收到 "+snap.get("answerCount")+" 份答卷。下方有效数、缺失、比例及均值由后端计算，分母按每题有效回答人数。",
            "title",snap.get("title"),"answerCount",snap.get("answerCount"),"statistics",data,"daily",snap.get("daily"),"openResponseCount",snap.get("openResponseCount"),"citations",Collections.singletonList(map("id","S1","kind","statistics","formKey",key,"version",v.getVersionNo(),"text","发布版本V"+v.getVersionNo()+"的全量后端统计","answerCount",snap.get("answerCount"))));
    }
    private Map<String,Object> evidence(String key,UserFormVersionEntity v,Map<String,Object> args) {
        List<String> keywords=((List<?>)args.get("keywords")).stream().map(x->((String)x).trim()).distinct().collect(Collectors.toList());
        List<UserFormDataEntity> rows=answers.selectList(Wrappers.<UserFormDataEntity>lambdaQuery().eq(UserFormDataEntity::getFormKey,key).eq(UserFormDataEntity::getVersionNo,v.getVersionNo()).orderByAsc(UserFormDataEntity::getId).last("limit 5001"));
        if(rows.size()>5000)throw new BaseException("单版本超过5000份答卷，本轮检索暂不支持；未用截断样本冒充全量");
        List<UserFormItemEntity> fields=versions.itemsOf(v).stream().filter(f->f.getType()!=null&&Arrays.asList("INPUT","TEXTAREA").contains(f.getType().name())&&!Boolean.TRUE.equals(f.getDisplayType())).collect(Collectors.toList());
        if(args.get("fieldId")!=null) {String id=(String)args.get("fieldId");fields=fields.stream().filter(f->id.equals(f.getFormItemId())).collect(Collectors.toList());if(fields.isEmpty())throw new BaseException("所选题目不是该版本的开放题");}
        List<Map<String,Object>> matched=new ArrayList<>();Set<String> matchingAnswers=new HashSet<>();int total=0,longExcluded=0;
        for(UserFormDataEntity row:rows)for(UserFormItemEntity field:fields) {
            Object raw=row.getOriginalData()==null?null:row.getOriginalData().get(field.getFormItemId());if(!(raw instanceof String)||((String)raw).trim().isEmpty())continue;
            String text=(String)raw,fold=text.toLowerCase(Locale.ROOT);int score=0;for(String term:keywords)if(fold.contains(term.toLowerCase(Locale.ROOT)))score++;
            if(score==0)continue;total++;matchingAnswers.add(String.valueOf(row.getId()));if(text.length()>4000){longExcluded++;continue;}
            matched.add(map("id","A"+row.getId()+"-"+field.getFormItemId(),"kind","answer","formKey",key,"version",v.getVersionNo(),"answerId",String.valueOf(row.getId()),"fieldId",field.getFormItemId(),"question",HtmlUtils.cleanHtmlTag(field.getLabel()),"text",text,"score",score,"source","CORE_OPEN_RESPONSE"));
        }
        matched.sort(Comparator.comparingInt((Map<String,Object> e)->((Number)e.get("score")).intValue()).reversed());int limit=args.containsKey("limit")?integer(args.get("limit"),1,10,"条数"):5;
        List<Map<String,Object>> returned=new ArrayList<>(matched.subList(0,Math.min(limit,matched.size())));returned.forEach(e->e.remove("score"));
        return map("kind","evidence","message","对 V"+v.getVersionNo()+" 的 "+rows.size()+" 份答卷进行字面关键词检索，匹配 "+total+" 条开放回答、涉及 "+matchingAnswers.size()+" 份不同答卷；返回 "+returned.size()+" 条原文证据。匹配数不是持某种观点的人数，也不作为总体比例。",
            "retrievalMode","KEYWORD_LITERAL","keywords",keywords,"scannedAnswerCount",rows.size(),"matchedResponseCount",total,"matchedAnswerCount",matchingAnswers.size(),"longTextExcludedCount",longExcluded,"returnedEvidenceCount",returned.size(),"citations",returned);
    }
    private Map<String,Object> report(String key,UserFormVersionEntity v) {
        List<AnalysisReportEntity> found=reports.selectList(Wrappers.<AnalysisReportEntity>lambdaQuery().eq(AnalysisReportEntity::getFormKey,key).eq(AnalysisReportEntity::getVersionNo,v.getVersionNo()).eq(AnalysisReportEntity::getStatus,"APPROVED").orderByDesc(AnalysisReportEntity::getCreatedAt).last("limit 1"));
        if(found.isEmpty())return map("kind","report","message","V"+v.getVersionNo()+" 暂无人工审核通过的报告。请到统计页生成并审核；助手不会将待审核候选当作确定结论。","available",false,"citations",Collections.emptyList());
        AnalysisReportEntity r=found.get(0);Map<String,Object> snap=snapshots.capture(key,v.getVersionNo());boolean changed=!r.getSnapshotHash().equals(snap.get("fingerprint"));
        if(changed)return map("kind","report","message","找到已审核历史报告，但答卷已变化。请重新生成并审核后再查询当前结论。","available",false,"dataChanged",true,"reportId",r.getId(),"citations",Collections.emptyList());
        Map<String,Object> saved=read(r.getSnapshotJson()),output=read(r.getOutputJson());
        Set<String> refs=new HashSet<>();for(Map<String,Object> t:(List<Map<String,Object>>)output.get("themes"))refs.addAll((List<String>)t.get("evidenceIds"));
        List<Map<String,Object>> evidence=((List<Map<String,Object>>)saved.get("evidence")).stream().filter(e->refs.contains(e.get("id"))).collect(Collectors.toList());
        return map("kind","report","message","读取到 V"+v.getVersionNo()+" 的人工审核通过报告。归纳来源为 "+r.getProvider()+"；主题支持数仅指报告列出的证据，不是总体比例。","available",true,"dataChanged",false,"reportId",r.getId(),"reportMode",r.getMode(),"reportCreatedAt",r.getCreatedAt(),"reviewNote",r.getReviewNote(),"output",output,"citations",evidence);
    }
    public static List<Map<String,Object>> definitions() {
        Map<String,Object> key=map("type","string","maxLength",64),version=map("type","integer","minimum",1),limit=map("type","integer","minimum",1,"maximum",10);
        Map<String,Object> question=map("type","object","properties",map("type",map("type","string","enum",Arrays.asList("RADIO","CHECKBOX","RATE","TEXT")),"label",map("type","string"),"required",map("type","boolean"),"options",map("type","array","items",map("type","string")),"rateMax",map("type","integer"),"placeholder",map("type","string")),"additionalProperties",false);
        List<Map<String,Object>> list=new ArrayList<>();
        list.add(def("survey_knowledge","检索当前问卷版本的知识库和真实后端统计，再由LLM综合回答。总结、原因、需求、建议、主要发现应使用此工具，不能用survey_details代替分析。question保留用户的实际问题。",map("formKey",key,"version",version,"question",map("type","string","maxLength",1000)),Arrays.asList("formKey","question")));
        list.add(def("search_surveys","查找当前账号自己的问卷，按名称、创建日期与状态过滤",map("query",map("type","string","maxLength",100),"limit",limit,"status",map("type","integer","minimum",1,"maximum",3),"fromDate",map("type","string","format","date"),"untilDate",map("type","string","format","date")),Collections.emptyList()));
        list.add(def("survey_stats","根据真实答卷生成数据图和分析面板；包含选项分布、评分、缺失及每日趋势。用户要求画图时必须调用，不要声称无法画图。可用fieldQuery指定题干关键词，chartType指定图形",map("formKey",key,"version",version,"chartType",map("type","string","enum",Arrays.asList("all","bar","donut","line")),"fieldQuery",map("type","string","maxLength",100)),Collections.singletonList("formKey")));
        list.add(def("search_answers","对本版本核心开放回答进行字面关键词检索；不是向量语义搜索或总体观点统计",map("formKey",key,"version",version,"keywords",map("type","array","items",map("type","string","maxLength",30),"minItems",1,"maxItems",6),"fieldId",map("type","string","maxLength",100),"limit",limit),Arrays.asList("formKey","keywords")));
        list.add(def("survey_report","读取本版本已人工审核且当前数据未变化的报告；不返回未审核候选结论",map("formKey",key,"version",version),Collections.singletonList("formKey")));
        list.add(def("survey_details","读取问卷草稿题目、简介；指定version则读取冻结版本",map("formKey",key,"version",version),Collections.singletonList("formKey")));
        list.add(def("survey_versions","查看发布版本及各版本答卷数",map("formKey",key),Collections.singletonList("formKey")));
        list.add(def("survey_share","获取指定或最新版本分享链接",map("formKey",key,"version",version),Collections.singletonList("formKey")));
        list.add(def("survey_export","准备本账号问卷的单版本答卷导出，最多5000份，原文不发送模型",map("formKey",key,"version",version),Collections.singletonList("formKey")));
        list.add(def("manage_survey","仅准备管理预览，用户点击确认后执行。CREATE新建/RENAME标题/DESCRIBE简介/REPLACE_QUESTIONS完整题目/ADD_QUESTION追加question/EDIT_QUESTION修改questionNo题的question部分字段/REMOVE_QUESTION删除questionNo题/MOVE_QUESTION从questionNo移动至toPosition/COPY复制/PUBLISH发布/STOP停收/ARCHIVE回收站。新建不指定formKey，其余必须为selectedFormKey",map("formKey",key,"action",map("type","string","enum",new ArrayList<>(AssistantWorkspace.ACTIONS)),"title",map("type","string","maxLength",100),"description",map("type","string","maxLength",2000),"questions",map("type","array","maxItems",30,"items",question),"question",question,"questionNo",map("type","integer","minimum",1),"toPosition",map("type","integer","minimum",1)),Collections.singletonList("action")));
        list.add(def("design_survey","根据目标设计问卷，返回完整题目预览，确认后保存草稿。模型未配置时明确标注Mock",map("goal",map("type","string","maxLength",500),"audience",map("type","string","maxLength",100),"questionCount",map("type","integer","minimum",1,"maximum",com.tduck.cloud.form.ai.AiDraftValidator.MAX_QUESTIONS)),Collections.singletonList("goal")));
        return list;
    }
    private static Map<String,Object> def(String name,String description,Map<String,Object> properties,List<String> required) {
        return map("name",name,"description",description,"inputSchema",map("type","object","properties",properties,"required",required,"additionalProperties",false),"annotations",map("readOnlyHint",true,"destructiveHint",false,"openWorldHint",false));
    }
}
