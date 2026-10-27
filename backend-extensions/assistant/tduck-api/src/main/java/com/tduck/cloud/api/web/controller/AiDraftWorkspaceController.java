package com.tduck.cloud.api.web.controller;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.ai.AiDraftWorkspaceService;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequiredArgsConstructor @RequestMapping("/user/form/ai/workspace")
public class AiDraftWorkspaceController {
    private final AiDraftWorkspaceService workspace;
    private final AssistantRateLimit rates;
    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
    @GetMapping public Result get(@RequestAttribute Long userId){rates.check(userId,"draft-read",120);return Result.success(workspace.get(userId));}
    @PostMapping public Result save(@RequestBody Map<String,Object> snapshot,@RequestAttribute Long userId){rates.check(userId,"draft-save",30);return Result.success(workspace.save(userId,snapshot));}
    @PostMapping("/clear") public Result clear(@RequestAttribute Long userId){rates.check(userId,"draft-save",30);workspace.clear(userId);return Result.success();}
}
