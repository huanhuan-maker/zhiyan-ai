package com.tduck.cloud.api.web.controller;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.ai.AiDraftSlotsService;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequiredArgsConstructor @RequestMapping("/user/form/ai/workspace/slots")
public class AiDraftSlotsController {
 private final AiDraftSlotsService slots;private final AssistantRateLimit rates;
 @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
 @GetMapping public Result list(@RequestAttribute Long userId){rates.check(userId,"draft-read",120);return Result.success(slots.list(userId));}
 @GetMapping("/{id}") public Result get(@RequestAttribute Long userId,@PathVariable String id){rates.check(userId,"draft-read",120);return Result.success(slots.get(userId,id));}
 @PostMapping public Result create(@RequestAttribute Long userId,@RequestBody Map<String,Object> body){rates.check(userId,"draft-save",30);return Result.success(slots.create(userId,body));}
 @PostMapping("/{id}") public Result update(@RequestAttribute Long userId,@PathVariable String id,@RequestBody Map<String,Object> body){rates.check(userId,"draft-save",30);return Result.success(slots.update(userId,id,body));}
 @PostMapping("/{id}/remove") public Result remove(@RequestAttribute Long userId,@PathVariable String id){rates.check(userId,"draft-save",30);slots.remove(userId,id);return Result.success();}
}
