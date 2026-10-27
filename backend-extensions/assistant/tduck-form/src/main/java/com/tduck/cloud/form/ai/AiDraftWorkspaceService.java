package com.tduck.cloud.form.ai;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.assistant.AssistantTools;
import com.tduck.cloud.form.assistant.AssistantWorkspace;
import com.tduck.cloud.form.entity.AiDraftWorkspaceEntity;
import com.tduck.cloud.form.mapper.AiDraftWorkspaceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

@Service @RequiredArgsConstructor
public class AiDraftWorkspaceService {
    private final AiDraftWorkspaceMapper mapper;
    public Map<String,Object> get(Long owner){AiDraftWorkspaceEntity row=mapper.selectById(owner);return row==null?map("snapshot",null,"updatedAt",null):map("snapshot",read(row.getSnapshotJson()),"updatedAt",row.getUpdatedAt());}
    public Map<String,Object> save(Long owner,Map<String,Object> snapshot){validate(snapshot);String now=Instant.now().toString();mapper.saveSnapshot(owner,write(snapshot),now);return map("updatedAt",now);}
    public void clear(Long owner){mapper.deleteById(owner);}
    public static void validate(Map<String,Object> snapshot){
        if(snapshot==null||!new HashSet<>(Arrays.asList("form","result")).containsAll(snapshot.keySet())||!(snapshot.get("form") instanceof Map))throw new BaseException("暂存内容格式不正确");
        if(write(snapshot).getBytes(StandardCharsets.UTF_8).length>524288)throw new BaseException("暂存内容超过512KB，请减少内容后重试");
        Map<?,?> form=(Map<?,?>)snapshot.get("form");if(!new HashSet<>(Arrays.asList("goal","audience","extra","questionCount")).containsAll(form.keySet()))throw new BaseException("调查需求包含不支持的字段");
        bounded(form.get("goal"),500,"调查目标");bounded(form.get("audience"),100,"目标人群");bounded(form.get("extra"),500,"补充信息");AssistantTools.integer(form.get("questionCount"),1,AiDraftValidator.MAX_QUESTIONS,"题数");
        Object raw=snapshot.get("result");if(raw==null)return;if(!(raw instanceof Map))throw new BaseException("草稿格式不正确");Map<String,Object> result=(Map<String,Object>)raw;
        Set<String> allowed=new HashSet<>(Arrays.asList("kind","title","description","questions","mode","provider","model","elapsedMs","warnings","assumptions","dimensions","clarification","manuallyEdited"));
        if(!allowed.containsAll(result.keySet()))throw new BaseException("草稿包含不支持的字段");
        if("draft".equals(result.get("kind"))){
            AssistantWorkspace.text(result.get("title"),100,"标题");bounded(result.get("description"),2000,"简介");
            if(!(result.get("questions") instanceof List))throw new BaseException("草稿缺少题目");
            List<Map<String,Object>> questions=new ArrayList<>();for(Object q:(List<?>)result.get("questions")){if(!(q instanceof Map))throw new BaseException("题目格式不正确");Map<String,Object> copy=new LinkedHashMap<>((Map<String,Object>)q);if("".equals(copy.get("placeholder")))copy.remove("placeholder");questions.add(copy);}AssistantWorkspace.normalizedQuestions(questions);
        }else if(!"clarification".equals(result.get("kind")))throw new BaseException("不支持此草稿类型");
    }
    private static void bounded(Object value,int max,String label){if(value!=null&&(!(value instanceof String)||((String)value).length()>max))throw new BaseException(label+"不能超过"+max+"字");}
}
