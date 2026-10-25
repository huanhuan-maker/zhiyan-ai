package com.tduck.cloud.form.assistant;
import com.tduck.cloud.common.exception.BaseException;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class AssistantRateLimit {
    private long minute;
    private final Map<String,Integer> counters=new HashMap<>();
    public synchronized void check(Long user,String operation,int limit) {
        long now=System.currentTimeMillis()/60000;if(now!=minute){counters.clear();minute=now;}
        String key=user+":"+operation;int count=counters.getOrDefault(key,0)+1;
        if(counters.size()>4096||count>limit)throw new BaseException("问卷助手请求过于频繁，请稍后重试；普通答题不受影响");counters.put(key,count);
    }
}
