package com.tduck.cloud.form.ai;

import com.tduck.cloud.common.exception.BaseException;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.function.LongSupplier;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Bounded transient lifecycle events, never model reasoning or questionnaire/answer contents. */
@Component
public class AiDraftProgress {
    private static final long TTL=15*60*1000L;
    private static final int CAPACITY=512;
    private final Map<String,Run> runs=new HashMap<>();
    private final LongSupplier clock;
    public AiDraftProgress(){this(System::currentTimeMillis);}
    public AiDraftProgress(LongSupplier clock){this.clock=clock;}
    private static final Map<String,String> LABELS=new LinkedHashMap<>();
    static {
        LABELS.put("REGISTERED","请求已登记，准备提交调查需求");
        LABELS.put("RECEIVED","服务器已接收调查需求");
        LABELS.put("INPUT_VALIDATED","调查目标、人群和题数已通过输入检查");
        LABELS.put("MODEL_RUNNING","模型正在设计问卷，请稍候");
        LABELS.put("MOCK_RUNNING","正在使用明确标注的本地模板生成");
        LABELS.put("VALIDATING","已收到生成结果，正在检查题型、选项和题数");
        LABELS.put("SUCCEEDED","草稿检查完成，可以逐题审核");
        LABELS.put("CLARIFICATION","需要补充调查需求，请查看澄清问题");
        LABELS.put("FAILED","本次生成未完成，输入和原有草稿已保留");
    }
    private static class Run {
        Long owner;long created;boolean claimed;String phase;List<Map<String,Object>> events=new ArrayList<>();
    }
    private void expire(){long now=clock.getAsLong();runs.values().removeIf(r->now-r.created>TTL);}
    public synchronized Map<String,Object> start(Long owner){
        expire();if(runs.size()>=CAPACITY)throw new BaseException("进度服务暂忙，可直接生成或稍后重试");
        long pending=runs.values().stream().filter(r->Objects.equals(r.owner,owner)&&!terminal(r.phase)).count();
        if(pending>=3)throw new BaseException("已有生成请求，请等待完成后重试");
        String id=UUID.randomUUID().toString();Run r=new Run();r.owner=owner;r.created=clock.getAsLong();runs.put(id,r);event(r,"REGISTERED");return map("id",id,"phase",r.phase);
    }
    public synchronized void claim(String id,Long owner){Run r=owned(id,owner);if(r.claimed)throw new BaseException("该生成请求已提交，请勿重复发送");r.claimed=true;event(r,"RECEIVED");}
    public synchronized void phase(String id,Long owner,String phase){Run r=owned(id,owner);if(!r.claimed||!LABELS.containsKey(phase))throw new BaseException("进度状态不正确");if(!terminal(r.phase))event(r,phase);}
    public synchronized Map<String,Object> get(String id,Long owner){Run r=owned(id,owner);List<Map<String,Object>> events=new ArrayList<>();for(Map<String,Object> e:r.events)events.add(new LinkedHashMap<>(e));return map("id",id,"phase",r.phase,"events",events,"elapsedMs",Math.max(0,clock.getAsLong()-r.created),"terminal",terminal(r.phase));}
    private Run owned(String id,Long owner){expire();Run r=runs.get(id);if(r==null||!Objects.equals(owner,r.owner))throw new BaseException("生成进度不可用，请等待本次生成返回");return r;}
    private void event(Run r,String phase){r.phase=phase;r.events.add(map("phase",phase,"message",LABELS.get(phase),"elapsedMs",Math.max(0,clock.getAsLong()-r.created)));}
    private static boolean terminal(String phase){return Arrays.asList("SUCCEEDED","CLARIFICATION","FAILED").contains(phase);}
}
