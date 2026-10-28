package com.tduck.cloud.api.web.controller;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.assistant.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor @RequestMapping("/user/form/knowledge")
public class SurveyKnowledgeController {
    private final SurveyKnowledgeService knowledge;
    private final AssistantRateLimit rates;
    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse r){r.setHeader("Cache-Control","no-store");}
    @GetMapping public Result list(@RequestAttribute Long userId){rates.check(userId,"knowledge-read",60);return Result.success(knowledge.list(userId));}
    @PostMapping("/sync") public Result sync(@RequestBody Input in,@RequestAttribute Long userId){rates.check(userId,"knowledge-sync",20);return Result.success(knowledge.preview(in.formKey,in.version,"问卷调查背景与受访者主要反馈",userId));}
    @PostMapping("/search") public Result search(@RequestBody Input in,@RequestAttribute Long userId){rates.check(userId,"knowledge-read",60);return Result.success(knowledge.preview(in.formKey,in.version,in.question,userId));}
    @Data public static class Input {private String formKey;private Integer version;private String question;}
}
