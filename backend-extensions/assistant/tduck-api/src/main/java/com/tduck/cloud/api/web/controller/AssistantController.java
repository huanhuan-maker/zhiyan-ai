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
    @Data public static class Decision {private Boolean confirm;}
    @Data public static class Input {private String conversationId;private String id;private String question;private String formKey;private Integer version;private String mode="LOCAL";private Boolean allowQuestionTransfer;}
}
