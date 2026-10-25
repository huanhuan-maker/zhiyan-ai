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
    public Map<String,Object> history(String id,Long owner) {
        AssistantConversationEntity c=requireConversation(id,owner);
        List<AssistantTurnEntity> rows=turns.selectList(Wrappers.<AssistantTurnEntity>lambdaQuery().eq(AssistantTurnEntity::getConversationId,id).eq(AssistantTurnEntity::getOwnerId,owner).orderByDesc(AssistantTurnEntity::getCreatedAt).last("limit 40"));
        Collections.reverse(rows);return map("id",id,"title",c.getTitle(),"turns",rows.stream().map(t->view(t,owner)).collect(Collectors.toList()),"historyLimit",40);
    }
    private Map<String,Object> view(AssistantTurnEntity t,Long owner) {
        Map<String,Object> result=t.getResultJson()==null?null:read(t.getResultJson());boolean hidden=false;
        if(t.getScopeFormKey()!=null)try{tools.requireOwned(t.getScopeFormKey(),owner);}catch(BaseException e){result=map("kind","notice","message","原问卷已归档或不再有权限，已隐藏历史查询结果。","citations",Collections.emptyList());hidden=true;}
        if(result!=null&&"surveys".equals(result.get("kind"))) {
            List<Map<String,Object>> visible=new ArrayList<>();
            for(Map<String,Object> row:(List<Map<String,Object>>)result.get("surveys"))try{tools.requireOwned((String)row.get("formKey"),owner);visible.add(row);}catch(BaseException ignored){}
            if(visible.size()!=((List<?>)result.get("surveys")).size())result.put("message","历史搜索快照中部分问卷已归档或失去权限，已隐藏相关条目。");result.put("surveys",visible);
        }
        return map("id",t.getId(),"question",t.getQuestion(),"formKey",t.getScopeFormKey(),"version",t.getScopeVersion(),"state",t.getState(),"mode",t.getMode(),"provider",t.getProvider(),"model",t.getModel(),"warning",t.getWarning(),"createdAt",t.getCreatedAt(),"plan",hidden?null:t.getPlanJson()==null?null:read(t.getPlanJson()),"result",result);
    }
    public Map<String,Object> plan(Long owner,String conversation,String id,String question,String key,Integer version,boolean real,boolean consent) {
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
            List<String> prior=new ArrayList<>();
            if(real&&consent){
                com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AssistantTurnEntity> query=Wrappers.<AssistantTurnEntity>lambdaQuery()
                    .eq(AssistantTurnEntity::getConversationId,conversation).eq(AssistantTurnEntity::getOwnerId,owner).ne(AssistantTurnEntity::getId,id).eq(AssistantTurnEntity::getState,"SUCCEEDED");
                if(key==null)query.isNull(AssistantTurnEntity::getScopeFormKey);else query.eq(AssistantTurnEntity::getScopeFormKey,key);
                if(version==null)query.isNull(AssistantTurnEntity::getScopeVersion);else query.eq(AssistantTurnEntity::getScopeVersion,version);
                for(AssistantTurnEntity row:turns.selectList(query.orderByDesc(AssistantTurnEntity::getCreatedAt).last("limit 20")))prior.add(row.getQuestion());
                Collections.reverse(prior);
            }
            p=planner.plan(question,key,version,real,consent,prior);
        }
        catch(Exception e){turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,id).set(AssistantTurnEntity::getState,"FAILED").set(AssistantTurnEntity::getWarning,"问题理解失败，可重新提问；普通答题不受影响"));throw new BaseException("问题理解失败，可重新提问");}
        String tool=(String)p.get("tool");t.setPlanJson(write(map("tool",tool,"arguments",p.get("arguments"))));t.setMode((String)p.get("mode"));t.setProvider((String)p.get("provider"));t.setModel((String)p.get("model"));t.setWarning((String)p.get("warning"));t.setState("READY");
        if("none".equals(tool)){t.setState("SUCCEEDED");t.setResultJson(write(map("kind","notice","message","当前助手只支持查找问卷、版本统计、开放回答关键词检索和已审核报告。请明确查询范围；不会修改、发布或删除问卷。","citations",Collections.emptyList())));}
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
            Map<String,Object> result=tools.call(name,args,owner);
            turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getState,"SUCCEEDED").set(AssistantTurnEntity::getResultJson,write(result)));
            return result;
        } catch(Exception e) {
            String message=e instanceof BaseException?e.getMessage():"工具查询失败，请稍后重试";
            turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,turnId).set(AssistantTurnEntity::getState,"FAILED").set(AssistantTurnEntity::getWarning,message));throw new BaseException(message);
        }
    }
}
