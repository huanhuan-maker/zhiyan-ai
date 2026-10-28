package com.tduck.cloud.form.assistant;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

@Service @RequiredArgsConstructor
public class AssistantChatService {
    private final AssistantConversationMapper conversations;
    private final AssistantTurnMapper turns;
    private final AssistantPlanner planner;
    private final AssistantTools tools;
    public static void uuid(String id){if(id==null||!id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))throw new BaseException("对话编号格式不正确");}
    private AssistantConversationEntity requireConversation(String id,Long owner) {uuid(id);AssistantConversationEntity c=conversations.selectById(id);if(c==null||!Objects.equals(c.getOwnerId(),owner))throw new BaseException("对话不存在或无权访问");return c;}
    public List<Map<String,Object>> list(Long owner) {
        return conversations.selectList(Wrappers.<AssistantConversationEntity>lambdaQuery().eq(AssistantConversationEntity::getOwnerId,owner).orderByDesc(AssistantConversationEntity::getUpdatedAt).last("limit 20"))
            .stream().map(c->map("id",c.getId(),"title",c.getTitle(),"updatedAt",c.getUpdatedAt())).collect(Collectors.toList());
    }
    public Map<String,Object> create(Long owner) {
        AssistantConversationEntity c=new AssistantConversationEntity();c.setId(UUID.randomUUID().toString());c.setOwnerId(owner);c.setTitle("新对话");c.setCreatedAt(Instant.now().toString());c.setUpdatedAt(c.getCreatedAt());conversations.insert(c);return map("id",c.getId(),"title",c.getTitle());
    }
    public Map<String,Object> delete(String id,Long owner) {
        requireConversation(id,owner);
        turns.delete(Wrappers.<AssistantTurnEntity>lambdaQuery().eq(AssistantTurnEntity::getConversationId,id).eq(AssistantTurnEntity::getOwnerId,owner));
        conversations.delete(Wrappers.<AssistantConversationEntity>lambdaQuery().eq(AssistantConversationEntity::getId,id).eq(AssistantConversationEntity::getOwnerId,owner));
        return map("id",id,"deleted",true);
    }
    public Map<String,Object> history(String id,Long owner) {
        AssistantConversationEntity c=requireConversation(id,owner);
        List<AssistantTurnEntity> rows=turns.selectList(Wrappers.<AssistantTurnEntity>lambdaQuery().eq(AssistantTurnEntity::getConversationId,id).eq(AssistantTurnEntity::getOwnerId,owner).orderByDesc(AssistantTurnEntity::getCreatedAt).last("limit 40"));
        Collections.reverse(rows);return map("id",id,"title",c.getTitle(),"turns",rows.stream().map(t->view(t,owner)).collect(Collectors.toList()),"historyLimit",40);
    }
    private Map<String,Object> view(AssistantTurnEntity t,Long owner) {
        Map<String,Object> result=t.getResultJson()==null?null:read(t.getResultJson());boolean hidden=false;
        if(t.getScopeFormKey()!=null&&!(result!=null&&Arrays.asList("action_result","action_cancelled").contains(result.get("kind"))))try{tools.requireOwned(t.getScopeFormKey(),owner);}catch(BaseException e){result=map("kind","notice","message","原问卷已归档或不再有权限，已隐藏历史查询结果。","citations",Collections.emptyList());hidden=true;}
        if(result!=null&&"surveys".equals(result.get("kind"))) {
            List<Map<String,Object>> visible=new ArrayList<>();
            for(Map<String,Object> row:(List<Map<String,Object>>)result.get("surveys"))try{tools.requireOwned((String)row.get("formKey"),owner);visible.add(row);}catch(BaseException ignored){}
            if(visible.size()!=((List<?>)result.get("surveys")).size())result.put("message","历史搜索快照中部分问卷已归档或失去权限，已隐藏相关条目。");result.put("surveys",visible);
        }
        return map("id",t.getId(),"question",t.getQuestion(),"formKey",t.getScopeFormKey(),"version",t.getScopeVersion(),"state",t.getState(),"mode",t.getMode(),"provider",t.getProvider(),"model",t.getModel(),"warning",t.getWarning(),"createdAt",t.getCreatedAt(),"plan",hidden?null:t.getPlanJson()==null?null:read(t.getPlanJson()),"result",result);
    }
    public Map<String,Object> plan(Long owner,String conversation,String id,String question,String key,Integer version,boolean real,boolean consent) {
        return planInternal(owner,conversation,id,question,key,version,real,consent,false);
    }
    public Map<String,Object> autoPlan(Long owner,String conversation,String id,String question,String key,Integer version) {
        return planInternal(owner,conversation,id,question,key,version,true,true,true);
    }
    private Map<String,Object> planInternal(Long owner,String conversation,String id,String question,String key,Integer version,boolean real,boolean consent,boolean automatic) {
        AssistantConversationEntity c=requireConversation(conversation,owner);uuid(id);
        if(question==null||question.trim().isEmpty()||question.length()>1000)throw new BaseException("请填写1-1000字的查询问题");
        if(key!=null&&!key.isEmpty())tools.requireOwned(key,owner);else key=null;
        if(version!=null){AssistantTools.integer(version,1,100000,"版本");if(key==null)throw new BaseException("请先选择问卷再指定版本");}
        if(real&&!consent)throw new BaseException("请先确认允许将本次提问发送给模型；答卷原文不会发送");
        AssistantTurnEntity existing=turns.selectById(id);
        if(existing!=null)return replay(existing,owner,conversation,question,key,version);
        AssistantTurnEntity t=new AssistantTurnEntity();t.setId(id);t.setConversationId(conversation);t.setOwnerId(owner);t.setQuestion(question.trim());t.setScopeFormKey(key);t.setScopeVersion(version);t.setState("PLANNING");t.setMode(real?"REAL":"LOCAL");t.setProvider("");t.setModel("");t.setWarning("");t.setCreatedAt(Instant.now().toString());
        try{turns.insert(t);}catch(DuplicateKeyException e){return replay(turns.selectById(id),owner,conversation,question,key,version);}
        Map<String,Object> p;
        try {
            List<String> prior=new ArrayList<>();List<Map<String,Object>> messages=new ArrayList<>();
            if(real&&consent){
                com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AssistantTurnEntity> query=Wrappers.<AssistantTurnEntity>lambdaQuery()
                    .eq(AssistantTurnEntity::getConversationId,conversation).eq(AssistantTurnEntity::getOwnerId,owner).ne(AssistantTurnEntity::getId,id).eq(AssistantTurnEntity::getState,"SUCCEEDED");
                if(!automatic){if(key==null)query.isNull(AssistantTurnEntity::getScopeFormKey);else query.eq(AssistantTurnEntity::getScopeFormKey,key);if(version==null)query.isNull(AssistantTurnEntity::getScopeVersion);else query.eq(AssistantTurnEntity::getScopeVersion,version);}
                List<AssistantTurnEntity> history=turns.selectList(query.orderByDesc(AssistantTurnEntity::getCreatedAt).last("limit 20"));
                Collections.reverse(history);
                for(AssistantTurnEntity row:history){prior.add(row.getQuestion());Map<String,Object> exchange=map("user",row.getQuestion());
                    if(row.getResultJson()!=null){Map<String,Object> old=read(row.getResultJson());
                        boolean accessible=true;if(row.getScopeFormKey()!=null)try{tools.requireOwned(row.getScopeFormKey(),owner);}catch(BaseException ex){accessible=false;}
                        if(accessible&&("chat".equals(old.get("kind"))||("knowledge_answer".equals(old.get("kind"))&&Objects.equals(key,row.getScopeFormKey()))))exchange.put("assistant",old.get("message"));
                        else if(accessible){
                            // Only bounded facts and operation outcomes enter model history; answer text and exports stay local.
                            Map<String,Object> summary=map("kind",old.get("kind"),"formKey",old.get("formKey"),"title",old.get("title"),"version",old.get("version"));
                            if("statistics".equals(old.get("kind"))){summary.put("answerCount",old.get("answerCount"));summary.put("chartRequest",old.get("chartRequest"));}
                            if(Arrays.asList("action_proposal","action_result","action_cancelled").contains(old.get("kind")))summary.put("action",old.get("action"));
                            exchange.put("toolSummary",summary);
                        }
                    }messages.add(exchange);}
            }
            p=automatic?planner.automatic(question,key,version,messages):planner.plan(question,key,version,real,consent,prior);
        }
        catch(Exception e){turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,id).set(AssistantTurnEntity::getState,"FAILED").set(AssistantTurnEntity::getWarning,"问题理解失败，可重新提问；普通答题不受影响"));throw new BaseException("问题理解失败，可重新提问");}
        String tool=(String)p.get("tool");t.setPlanJson(write(map("tool",tool,"arguments",p.get("arguments"),"automatic",automatic,"stage",0)));t.setMode((String)p.get("mode"));t.setProvider((String)p.get("provider"));t.setModel((String)p.get("model"));t.setWarning((String)p.get("warning"));t.setState("READY");
        if("chat".equals(tool)){t.setState("SUCCEEDED");t.setResultJson(write(map("kind","chat","message",((Map<?,?>)p.get("arguments")).get("message"),"citations",Collections.emptyList())));}
        if(automatic&&Arrays.asList("survey_stats","search_answers","survey_report").contains(tool))t.setScopeVersion((Integer)((Map<?,?>)p.get("arguments")).get("version"));
        if("none".equals(tool)){t.setState("SUCCEEDED");t.setResultJson(write(map("kind","notice","message","这次请求超出支持范围，或缺少具体内容。可以查询与分析自己的问卷，也可以生成、新建、复制、改名、修改简介或完整草稿题目、发布、停收和移入回收站。管理操作须核对预览后点击确认；不能执行SQL、访问其他账号或永久删除答卷。","citations",Collections.emptyList())));}
        turns.updateById(t);
        conversations.update(null,Wrappers.<AssistantConversationEntity>lambdaUpdate().eq(AssistantConversationEntity::getId,c.getId()).eq(AssistantConversationEntity::getOwnerId,owner).set(AssistantConversationEntity::getTitle,question.trim().substring(0,Math.min(36,question.trim().length()))).set(AssistantConversationEntity::getUpdatedAt,Instant.now().toString()));
        return view(t,owner);
    }
    private Map<String,Object> replay(AssistantTurnEntity t,Long owner,String conversation,String question,String key,Integer version) {
        if(t==null||!Objects.equals(t.getOwnerId(),owner)||!Objects.equals(t.getConversationId(),conversation)||!Objects.equals(t.getQuestion(),question.trim())||!Objects.equals(t.getScopeFormKey(),key)||!Objects.equals(t.getScopeVersion(),version))throw new BaseException("请求编号已使用，未覆盖既有消息");return view(t,owner);
    }
    public Map<String,Object> execute(String turnId,String name,Map<String,Object> args,Long owner) {
        args=AssistantTools.normalizedArguments(name,args);
        uuid(turnId);AssistantTurnEntity t=turns.selectById(turnId);
        if(t==null||!Objects.equals(t.getOwnerId(),owner))throw new BaseException("查询消息不存在或无权访问");
        if(t.getScopeFormKey()!=null)tools.requireOwned(t.getScopeFormKey(),owner);
        Map<String,Object> p=t.getPlanJson()==null?Collections.emptyMap():read(t.getPlanJson());
        if(!Objects.equals(p.get("tool"),name)||!(p.get("arguments") instanceof Map)||!Objects.equals(AssistantTools.normalizedArguments(name,(Map<String,Object>)p.get("arguments")),args))throw new BaseException("工具请求与保存的规划不一致，未执行查询");
        if("SUCCEEDED".equals(t.getState()))return (Map<String,Object>)view(t,owner).get("result");
        int changed=turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).eq(AssistantTurnEntity::getOwnerId,owner).eq(AssistantTurnEntity::getState,"READY").set(AssistantTurnEntity::getState,"RUNNING"));
        if(changed!=1)throw new BaseException("查询正在处理或已失败，请刷新历史或重新提问");
        try {
            Map<String,Object> dispatch=Boolean.TRUE.equals(p.get("automatic"))?AssistantPlanner.naturalRead(map("tool",name,"arguments",args),t.getQuestion()):map("tool",name,"arguments",args);
            Map<String,Object> result=tools.call((String)dispatch.get("tool"),(Map<String,Object>)dispatch.get("arguments"),owner);
            if("search_surveys".equals(name)&&Boolean.TRUE.equals(p.get("automatic"))&&((Number)p.getOrDefault("stage",0)).intValue()==0) {
                List<Map<String,Object>> found=(List<Map<String,Object>>)result.get("surveys");
                boolean catalogue=AssistantPlanner.catalogueQuery(t.getQuestion());
                String selected=null;if(!catalogue)selected=((Number)result.get("total")).longValue()==1&&found.size()==1?(String)found.get(0).get("formKey"):planner.chooseSurvey(t.getQuestion(),found);
                Map<String,Object> target=null;for(Map<String,Object> row:found)if(Objects.equals(selected,row.get("formKey")))target=row;
                if(target!=null){tools.requireOwned(selected,owner);
                    Integer targetVersion=Objects.equals(selected,t.getScopeFormKey())?t.getScopeVersion():AssistantPlanner.versionHint(t.getQuestion());
                    Map<String,Object> next=AssistantPlanner.resolvedQuery(t.getQuestion(),selected,targetVersion,(String)target.get("title"));String nextTool=(String)next.get("tool");
                    if(!Arrays.asList("search_surveys","none","chat","design_survey").contains(nextTool)){
                        Map<String,Object> nextArgs=(Map<String,Object>)next.get("arguments");
                        turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getScopeFormKey,selected).set(AssistantTurnEntity::getScopeVersion,nextArgs.get("version"))
                            .set(AssistantTurnEntity::getPlanJson,write(map("tool",nextTool,"arguments",nextArgs,"automatic",true,"stage",1))).set(AssistantTurnEntity::getMode,next.get("mode")).set(AssistantTurnEntity::getProvider,next.get("provider")).set(AssistantTurnEntity::getModel,next.get("model")).set(AssistantTurnEntity::getWarning,next.get("warning")).set(AssistantTurnEntity::getState,"READY"));
                        return result;
                    }
                }
                String response=catalogue?"当前账号共有 "+result.get("total")+" 份匹配的问卷。直接告诉我想了解的主题，我会检索答卷后给你分析。":found.isEmpty()?"我没有找到与这个问题匹配的问卷。告诉我问卷名称或调查主题，我会继续检索并整理结论。":"我还不能确定你指的是哪份问卷。直接告诉我问卷名称或调查主题即可，我会检索答卷后给你总结分析。";
                result=map("kind","chat","message",response,"citations",Collections.emptyList());
            }
            if("knowledge_answer".equals(result.get("kind"))){
                turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getMode,result.get("generationMode")).set(AssistantTurnEntity::getProvider,result.getOrDefault("provider","知识库检索")).set(AssistantTurnEntity::getModel,result.getOrDefault("model","检索结果·未生成分析")));
            }
            turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getState,"SUCCEEDED").set(AssistantTurnEntity::getResultJson,write(result)));
            return result;
        } catch(Exception e) {
            if(e instanceof AssistantTools.UnpublishedSurvey){
                UserFormEntity source=tools.requireOwned((String)args.get("formKey"),owner);
                Map<String,Object> notice=map("kind","notice","reason","UNPUBLISHED","message","这份问卷尚未发布，暂时没有发布版本的统计、回答原文或审核报告。你可以查询其他问卷；如需发布，请到问卷管理页操作。","formKey",source.getFormKey(),"title",source.getTextName(),"asOf",Instant.now().toString(),"citations",Collections.emptyList());
                turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getState,"SUCCEEDED").set(AssistantTurnEntity::getResultJson,write(notice)));
                return notice;
            }
            String message=e instanceof BaseException?e.getMessage():"工具查询失败，请稍后重试";
            turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getState,"FAILED").set(AssistantTurnEntity::getWarning,message));throw new BaseException(message);
        }
    }
}
