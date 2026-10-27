package com.tduck.cloud.api.web.controller;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.ai.AiSurveyDesignService;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequiredArgsConstructor @RequestMapping("/user/form/ai")
public class AiSurveyDesignController {
    private final AiSurveyDesignService design;
    private final AssistantRateLimit rates;
    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
    @PostMapping("/optimize-question") public Result optimize(@RequestAttribute Long userId,@RequestBody Map<String,Object> request){rates.check(userId,"ai-design",20);return Result.success(design.optimize(request,userId));}
    @PostMapping("/review-survey") public Result review(@RequestAttribute Long userId,@RequestBody Map<String,Object> request){rates.check(userId,"ai-design",20);return Result.success(design.review(request,userId));}
}
