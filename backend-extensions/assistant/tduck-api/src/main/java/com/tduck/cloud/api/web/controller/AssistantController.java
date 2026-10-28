package com.tduck.cloud.api.web.controller;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.assistant.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/user/form/assistant")
public class AssistantController {
    private final AssistantChatService chat;
    private final AssistantPlanner planner;
    private final AssistantTools tools;
    private final AssistantRateLimit rates;
    private final AssistantActionService actions;
    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
    @GetMapping("/status") public Result status(@RequestAttribute Long userId){return Result.success(planner.status());}
    @GetMapping("/conversations") public Result list(@RequestAttribute Long userId){rates.check(userId,"read",120);return Result.success(chat.list(userId));}
    @PostMapping("/conversations") public Result create(@RequestAttribute Long userId){rates.check(userId,"conversation",15);return Result.success(chat.create(userId));}
    @GetMapping("/conversations/{id}") public Result history(@PathVariable String id,@RequestAttribute Long userId){rates.check(userId,"read",120);return Result.success(chat.history(id,userId));}
    @PostMapping("/conversations/{id}/delete") public Result delete(@PathVariable String id,@RequestAttribute Long userId){rates.check(userId,"conversation",15);return Result.success(chat.delete(id,userId));}
    @GetMapping("/versions") public Result versions(@RequestParam String formKey,@RequestAttribute Long userId){rates.check(userId,"read",120);return Result.success(tools.versionChoices(formKey,userId));}
    @PostMapping("/plan") public Result plan(@RequestBody Input input,@RequestAttribute Long userId){
        if(!"REAL".equals(input.mode)&&!"LOCAL".equals(input.mode)&&!"AUTO".equals(input.mode))throw new BaseException("提问模式不正确");
        rates.check(userId,"plan-"+input.mode,"AUTO".equals(input.mode)?20:"REAL".equals(input.mode)?8:30);
        if("AUTO".equals(input.mode))return Result.success(chat.autoPlan(userId,input.conversationId,input.id,input.question,input.formKey,input.version));
        return Result.success(chat.plan(userId,input.conversationId,input.id,input.question,input.formKey,input.version,"REAL".equals(input.mode),Boolean.TRUE.equals(input.allowQuestionTransfer)));
    }
    @PostMapping("/actions/{id}/decision") public Result decision(@PathVariable String id,@RequestBody Decision input,@RequestAttribute Long userId){
        rates.check(userId,"action",20);if(input.confirm==null)throw new BaseException("请明确确认或取消操作");
        return Result.success(actions.decide(id,input.confirm,userId));
    }
    @PostMapping(value="/chat/stream",produces="text/event-stream;charset=UTF-8")
    public void stream(@RequestBody Input input,@RequestAttribute Long userId,javax.servlet.http.HttpServletResponse response) throws java.io.IOException {
        rates.check(userId,"plan-AUTO",20);
        response.setHeader("X-Accel-Buffering","no");response.setHeader("Cache-Control","no-store");
        response.setCharacterEncoding("UTF-8");response.setContentType("text/event-stream;charset=UTF-8");
        java.io.PrintWriter writer=response.getWriter();
        try{
            event(writer,"status",com.tduck.cloud.form.analysis.AnalysisJson.map("message","正在理解你的问题…"));
            java.util.Map<String,Object> turn=chat.autoPlan(userId,input.conversationId,input.id,input.question,input.formKey,input.version);
            for(int stage=0;stage<3&&"READY".equals(turn.get("state"));stage++){
                java.util.Map<String,Object> plan=(java.util.Map<String,Object>)turn.get("plan");String tool=(String)plan.get("tool");
                event(writer,"status",com.tduck.cloud.form.analysis.AnalysisJson.map("message","search_surveys".equals(tool)?"正在定位相关问卷…":"survey_knowledge".equals(tool)?"正在检索答卷、整理分析并核对来源…":"正在读取问卷资料…"));
                chat.execute(input.id,tool,(java.util.Map<String,Object>)plan.get("arguments"),userId);
                for(java.util.Map<String,Object> row:(java.util.List<java.util.Map<String,Object>>)chat.history(input.conversationId,userId).get("turns"))if(input.id.equals(row.get("id")))turn=row;
            }
            if(!"SUCCEEDED".equals(turn.get("state")))throw new BaseException("本次处理尚未完成，请刷新历史后继续");
            java.util.Map<String,Object> result=(java.util.Map<String,Object>)turn.get("result");
            String message=String.valueOf(result.getOrDefault("message",""));
            java.util.Map<String,Object> metadata=new java.util.LinkedHashMap<>(result);metadata.remove("message");
            event(writer,"answer",com.tduck.cloud.form.analysis.AnalysisJson.map("turn",turn.get("id"),"result",metadata));
            for(int offset=0;offset<message.length();){int end=message.offsetByCodePoints(offset,Math.min(24,message.codePointCount(offset,message.length())));event(writer,"delta",com.tduck.cloud.form.analysis.AnalysisJson.map("text",message.substring(offset,end)));offset=end;}
            event(writer,"done",com.tduck.cloud.form.analysis.AnalysisJson.map("id",input.id));
        }catch(Exception ex){event(writer,"error",com.tduck.cloud.form.analysis.AnalysisJson.map("message",ex instanceof BaseException?ex.getMessage():"回复中断，请重试或刷新历史"));}
    }
    private static void event(java.io.PrintWriter writer,String type,Object data) throws java.io.IOException {
        writer.write("event: "+type+"\ndata: "+com.tduck.cloud.form.analysis.AnalysisJson.write(data)+"\n\n");writer.flush();if(writer.checkError())throw new java.io.IOException("Client disconnected");
    }
    @Data public static class Decision {private Boolean confirm;}
    @Data public static class Input {private String conversationId;private String id;private String question;private String formKey;private Integer version;private String mode="LOCAL";private Boolean allowQuestionTransfer;}
}
