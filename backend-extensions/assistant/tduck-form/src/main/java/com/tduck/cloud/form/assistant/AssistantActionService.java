package com.tduck.cloud.form.assistant;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.entity.AssistantTurnEntity;
import com.tduck.cloud.form.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

@Service @RequiredArgsConstructor
public class AssistantActionService {
    private final AssistantTurnMapper turns;
    private final AssistantActionMapper actions;
    private final AssistantWorkspace workspace;

    @Transactional(rollbackFor=Exception.class,isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public Map<String,Object> decide(String id,boolean confirm,Long owner) {
        AssistantChatService.uuid(id);
        AssistantTurnEntity initial=turns.selectById(id);
        if(initial==null||!Objects.equals(initial.getOwnerId(),owner))throw new BaseException("操作不存在或无权确认");
        // Use the locked current row itself; selectById may return MyBatis' pre-lock session cache.
        AssistantTurnEntity t=actions.lockTurn(id);
        if(t==null||!Objects.equals(t.getOwnerId(),owner))throw new BaseException("操作不存在或无权确认");
        if(!"SUCCEEDED".equals(t.getState())||t.getResultJson()==null)throw new BaseException("请等待操作预览准备完成");
        Map<String,Object> proposal=read(t.getResultJson());String kind=(String)proposal.get("kind");
        if(Arrays.asList("action_result","action_cancelled").contains(kind))return proposal;
        if(!"action_proposal".equals(kind))throw new BaseException("这条消息没有可确认的操作");
        Map<String,Object> result;
        if(confirm){String key=(String)proposal.get("formKey");if(key!=null)actions.lockForm(key);result=workspace.apply(proposal,owner);}
        else result=map("kind","action_cancelled","message","已取消操作，问卷未作更改。","action",proposal.get("action"),"citations",Collections.emptyList());
        actions.audit(id,owner,(String)proposal.get("action"),confirm?"CONFIRMED":"CANCELLED",write(proposal),write(result),Instant.now().toString());
        turns.update(null,Wrappers.<AssistantTurnEntity>lambdaUpdate().eq(AssistantTurnEntity::getId,id).eq(AssistantTurnEntity::getOwnerId,owner).set(AssistantTurnEntity::getResultJson,write(result)));
        return result;
    }
}
