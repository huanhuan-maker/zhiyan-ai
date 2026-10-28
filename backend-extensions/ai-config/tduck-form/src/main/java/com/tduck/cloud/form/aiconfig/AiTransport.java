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

    public String stream(Selection s,String system,String input,java.util.function.Consumer<String> sink){
        if(s==null||s.key==null||s.key.isEmpty())throw new AiProviderException("真实模型尚未配置");HttpURLConnection c=null;
        try{
            Map<String,Object> body=payload(s,system,input);body.put("stream",true);byte[] request=JSON.writeValueAsBytes(body);
            String base=s.provider.getBaseUrl().replaceAll("/+$","");endpoint(base);c=(HttpURLConnection)new URL(base+path(s.provider.getProtocol())).openConnection();c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setConnectTimeout(s.provider.getTimeoutMs());c.setReadTimeout(s.provider.getTimeoutMs());c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Accept","text/event-stream");
            if("ANTHROPIC".equals(s.provider.getProtocol())){c.setRequestProperty("x-api-key",s.key);c.setRequestProperty("anthropic-version","2023-06-01");}else c.setRequestProperty("Authorization","Bearer "+s.key);
            c.setFixedLengthStreamingMode(request.length);try(OutputStream out=c.getOutputStream()){out.write(request);}if(c.getResponseCode()!=200)throw new AiProviderException("模型流式服务HTTP "+c.getResponseCode());
            return readStream(s.provider.getProtocol(),new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8),sink);
        }catch(AiProviderException e){throw e;}catch(Exception e){throw new AiProviderException("模型流式请求中断或格式异常；没有将未完成草稿保存为正式回答");}finally{if(c!=null)c.disconnect();}
    }
    public static String readStream(String protocol,Reader source,java.util.function.Consumer<String> sink)throws IOException{
        StringBuilder text=new StringBuilder(),data=new StringBuilder();boolean finished=false;String reason="";int bytes=0;
        try(BufferedReader reader=new BufferedReader(source)){String line;while((line=reader.readLine())!=null){bytes+=line.getBytes(StandardCharsets.UTF_8).length;if(bytes>2097152)throw new AiProviderException("模型流式响应超过2MB");
            if(!line.isEmpty()){if(line.startsWith("data:"))data.append(line.substring(5).trim());continue;}if(data.length()==0)continue;String payload=data.toString();data.setLength(0);if("[DONE]".equals(payload)){finished=true;continue;}
            JsonNode event=JSON.readTree(payload);if(event.has("error")||"error".equals(event.path("type").asText()))throw new AiProviderException("模型流返回错误，正文已省略");String delta="",type=event.path("type").asText();
            if("OPENAI_RESPONSES".equals(protocol)){if("response.output_text.delta".equals(type))delta=event.path("delta").asText();if("response.completed".equals(type)){reason=event.path("response").path("status").asText();finished=true;}if("response.failed".equals(type)||"response.incomplete".equals(type))throw new AiProviderException("模型流未完整结束");}
            else if("ANTHROPIC".equals(protocol)){if("content_block_delta".equals(type)&&"text_delta".equals(event.path("delta").path("type").asText()))delta=event.path("delta").path("text").asText();if("message_delta".equals(type))reason=event.path("delta").path("stop_reason").asText();if("message_stop".equals(type))finished=true;}
            else{JsonNode choice=event.path("choices").path(0);delta=choice.path("delta").path("content").asText("");if(!choice.path("finish_reason").isNull()&&!choice.path("finish_reason").isMissingNode())reason=choice.path("finish_reason").asText();}
            if(!delta.isEmpty()){text.append(delta);sink.accept(delta);}
        }}
        if(!finished||text.length()==0||!("OPENAI_RESPONSES".equals(protocol)?"completed".equals(reason):"ANTHROPIC".equals(protocol)?Arrays.asList("end_turn","stop_sequence").contains(reason):"stop".equals(reason)))throw new AiProviderException("模型流未完整结束，请重试");return text.toString();
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
