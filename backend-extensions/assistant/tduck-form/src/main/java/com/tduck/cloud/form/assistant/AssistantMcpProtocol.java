package com.tduck.cloud.form.assistant;

import com.tduck.cloud.common.exception.BaseException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Minimal stateless Streamable HTTP server, pinned MCP 2025-06-18, JSON response mode. */
@Service @RequiredArgsConstructor
public class AssistantMcpProtocol {
    public static final String VERSION="2025-06-18";
    private final AssistantTools tools;
    private final AssistantChatService chat;
    public Map<String,Object> handle(Map<String,Object> request,Long owner,String protocolVersion) {
        Object id=request.get("id");String method=request.get("method") instanceof String?(String)request.get("method"):"";
        if(!"2.0".equals(request.get("jsonrpc"))||method.isEmpty()||(request.containsKey("id")&&!(id instanceof String)&&!(id instanceof Number)))return error(id,-32600,"Invalid JSON-RPC request");
        Map<String,Object> params;
        if(request.get("params")!=null&&!(request.get("params") instanceof Map))return error(id,-32602,"Params must be an object");
        params=request.get("params")==null?Collections.emptyMap():(Map<String,Object>)request.get("params");
        if("initialize".equals(method)) {
            if(!request.containsKey("id")||!(params.get("protocolVersion") instanceof String)||!(params.get("capabilities") instanceof Map)||!(params.get("clientInfo") instanceof Map))return error(id,-32602,"Initialization parameters missing");
            return result(id,map("protocolVersion",VERSION,"capabilities",map("tools",map("listChanged",false)),"serverInfo",map("name","zhiyan-survey-readonly","version","1.0.0"),"instructions","Only owner-scoped read tools; keyword evidence is not population prevalence. Application authentication, local deployment only."));
        }
        if(!VERSION.equals(protocolVersion))return error(id,-32602,"Unsupported or missing MCP-Protocol-Version");
        if(!request.containsKey("id")) {
            if(method.startsWith("notifications/"))return null;
            return error(null,-32600,"Request ID required");
        }
        if("ping".equals(method))return result(id,map());
        if("tools/list".equals(method))return result(id,map("tools",AssistantTools.definitions()));
        if(!"tools/call".equals(method))return error(id,-32601,"Method not found");
        if(!(params.get("name") instanceof String)||!(params.get("arguments") instanceof Map))return error(id,-32602,"Tool name and arguments required");
        String name=(String)params.get("name");Map<String,Object> args=(Map<String,Object>)params.get("arguments");
        try{args=AssistantTools.normalizedArguments(name,args);}catch(BaseException e){return error(id,-32602,e.getMessage());}
        try {
            Object meta=params.get("_meta");if(meta!=null&&!(meta instanceof Map))return error(id,-32602,"Invalid metadata");
            Object turn=meta instanceof Map?((Map<?,?>)meta).get("assistantTurnId"):null;
            if(turn!=null&&!(turn instanceof String))return error(id,-32602,"Invalid assistantTurnId");
            Map<String,Object> output=turn==null?tools.call(name,args,owner):chat.execute((String)turn,name,args,owner);
            return result(id,map("content",Collections.singletonList(map("type","text","text",write(output))),"structuredContent",output,"isError",false));
        } catch(Exception e) {
            String message=e instanceof BaseException?e.getMessage():"查询失败，请稍后重试";
            return result(id,map("content",Collections.singletonList(map("type","text","text",message)),"isError",true));
        }
    }
    public static Map<String,Object> result(Object id,Object output){return map("jsonrpc","2.0","id",id,"result",output);}
    public static Map<String,Object> error(Object id,int code,String message){return map("jsonrpc","2.0","id",id,"error",map("code",code,"message",message));}
}
