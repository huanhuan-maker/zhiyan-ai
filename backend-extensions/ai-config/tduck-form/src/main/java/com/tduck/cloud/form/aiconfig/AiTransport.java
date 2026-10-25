package com.tduck.cloud.form.aiconfig;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.form.ai.AiProviderException;
import org.springframework.stereotype.Component;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.tduck.cloud.form.aiconfig.AiSettingsService.*;

@Component
public class AiTransport {
    private static Map<String,Object> map(Object... pairs){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)m.put((String)pairs[i],pairs[i+1]);return m;}
    public static String path(String protocol){return "ANTHROPIC".equals(protocol)?"/messages":"OPENAI_RESPONSES".equals(protocol)?"/responses":"/chat/completions";}
    public static Map<String,Object> payload(Selection s,String system,String input) {
        AiSettings.Model m=s.model;String protocol=s.provider.getProtocol(), effort=m.getReasoningEffort();
        // UTF-8 byte count plus framing is a deliberately conservative bound, not an exact tokenizer.
        long estimated=system.getBytes(StandardCharsets.UTF_8).length+(long)input.getBytes(StandardCharsets.UTF_8).length+1024;
        if(estimated+m.getMaxOutputTokens()>m.getContextWindow())throw new AiProviderException("输入超出所设上下文预算（UTF-8保守估算），请增加上下文或减少历史轮数/分析输入；未截断原文");
        Map<String,Object> body=map("model",m.getModelId(),"stream",false);
        if("OPENAI_RESPONSES".equals(protocol)) {
            body.put("instructions",system);body.put("input",input);body.put("store",false);body.put("max_output_tokens",m.getMaxOutputTokens());
            if(!"auto".equals(effort))body.put("reasoning",map("effort",effort));
        } else if("ANTHROPIC".equals(protocol)) {
            body.put("system",system);body.put("messages",Collections.singletonList(map("role","user","content",input)));body.put("max_tokens",m.getMaxOutputTokens());
            if("none".equals(effort))body.put("thinking",map("type","disabled"));
            else if(!"auto".equals(effort)){body.put("thinking",map("type","adaptive"));body.put("output_config",map("effort",effort));}
        } else {
            body.put("messages",Arrays.asList(map("role","system","content",system),map("role","user","content",input)));
            body.put(s.provider.getOutputTokenParameter(),m.getMaxOutputTokens());
            if(!"auto".equals(effort))body.put("reasoning_effort",effort);
        }
        return body;
    }

    public String complete(Selection s,String system,String input) {
        if(s==null||s.key==null||s.key.isEmpty())throw new AiProviderException("真实模型尚未配置，请到系统配置 → AI配置设置");
        byte[] request;
        try {request=JSON.writeValueAsBytes(payload(s,system,input));}catch(AiProviderException e){throw e;}catch(Exception e){throw new AiProviderException("模型请求组装失败");}
        HttpURLConnection c=null;
        try {
            String base=s.provider.getBaseUrl().replaceAll("/+$","");endpoint(base);
            c=(HttpURLConnection)new URL(base+path(s.provider.getProtocol())).openConnection();
            c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setConnectTimeout(s.provider.getTimeoutMs());c.setReadTimeout(s.provider.getTimeoutMs());c.setDoOutput(true);
            c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Accept","application/json");
            if("ANTHROPIC".equals(s.provider.getProtocol())){c.setRequestProperty("x-api-key",s.key);c.setRequestProperty("anthropic-version","2023-06-01");}
            else c.setRequestProperty("Authorization","Bearer "+s.key);
            c.setFixedLengthStreamingMode(request.length);try(OutputStream out=c.getOutputStream()){out.write(request);}
            int status=c.getResponseCode();if(status!=200)throw new AiProviderException("模型服务HTTP "+status+"，请检查协议、模型参数及凭据；响应正文已省略");
            ByteArrayOutputStream buffer=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1){if(buffer.size()+n>2097152)throw new AiProviderException("模型响应超过2MB限制");buffer.write(bytes,0,n);}}
            return parse(s.provider.getProtocol(),JSON.readTree(buffer.toByteArray()));
        } catch(AiProviderException e){throw e;}catch(Exception e){throw new AiProviderException("模型请求失败（超时、网络或响应格式异常）；普通问卷功能不受影响");}
        finally{if(c!=null)c.disconnect();}
    }

    public static String parse(String protocol,JsonNode body) {
        StringBuilder text=new StringBuilder();
        if(body.has("error"))throw new AiProviderException("模型服务返回错误，详细正文已省略");
        if("OPENAI_RESPONSES".equals(protocol)) {
            if(!"completed".equals(body.path("status").asText()))throw new AiProviderException("模型响应未完成，请检查输出上限与服务状态");
            for(JsonNode item:body.path("output"))if("message".equals(item.path("type").asText()))for(JsonNode content:item.path("content"))if("output_text".equals(content.path("type").asText()))text.append(content.path("text").asText());
        } else if("ANTHROPIC".equals(protocol)) {
            if(!"end_turn".equals(body.path("stop_reason").asText())&&!"stop_sequence".equals(body.path("stop_reason").asText()))throw new AiProviderException("模型输出未完整结束，请增加输出上限或调整模型参数");
            for(JsonNode block:body.path("content"))if("text".equals(block.path("type").asText()))text.append(block.path("text").asText());
        } else {
            JsonNode choice=body.path("choices").path(0);
            if(!"stop".equals(choice.path("finish_reason").asText()))throw new AiProviderException("模型输出未完整结束，请增加输出上限或调整模型参数");
            JsonNode content=choice.path("message").path("content");
            if(content.isTextual())text.append(content.asText());else if(content.isArray())for(JsonNode block:content)if("text".equals(block.path("type").asText()))text.append(block.path("text").asText());
        }
        if(text.toString().trim().isEmpty())throw new AiProviderException("模型没有返回可用文本，请检查模型与思考/输出设置");
        return text.toString();
    }
}
