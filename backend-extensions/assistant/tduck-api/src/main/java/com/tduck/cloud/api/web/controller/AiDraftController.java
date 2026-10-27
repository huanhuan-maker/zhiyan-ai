package com.tduck.cloud.api.web.controller;

import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.ai.AiDraftInput;
import com.tduck.cloud.form.ai.AiDraftService;
import com.tduck.cloud.form.ai.AiDraftProgress;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ModelAttribute;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * M2 AI 问卷草稿。仅登录发起者可用；AI 只生成草稿，
 * 不写问卷/题目数据，不触发发布（发布复用 M1 版本机制，由用户手动操作）。
 */
@Slf4j
@RequiredArgsConstructor
@RestController
public class AiDraftController {

    private final AiDraftService aiDraftService;
    private final AiDraftProgress progress;
    private final AssistantRateLimit rates;

    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}

    @PostMapping("/user/form/ai/draft/progress")
    public Result startProgress(@RequestAttribute Long userId){rates.check(userId,"draft-progress-start",20);return Result.success(progress.start(userId));}

    @GetMapping("/user/form/ai/draft/progress/{id}")
    public Result getProgress(@PathVariable String id,@RequestAttribute Long userId){rates.check(userId,"draft-progress-read",120);return Result.success(progress.get(id,userId));}

    /**
     * AI 状态：Provider 展示名、模型、真实 AI / Mock。
     * 不返回 API Key 或内部地址。
     */
    @GetMapping("/user/form/ai/status")
    public Result aiStatus(@RequestAttribute Long userId) {
        return Result.success(aiDraftService.status());
    }

    /**
     * 生成问卷草稿：返回结构化草稿与校验警告，供前端预览与人工编辑；
     * 校验失败、超时、坏 JSON 均返回可恢复的失败信息。
     */
    @PostMapping("/user/form/ai/draft")
    public Result aiDraft(@RequestBody AiDraftInput input, @RequestAttribute Long userId, @RequestParam(required=false) String progressId) {
        rates.check(userId,"draft-generate",20);
        if(progressId==null)return Result.success(aiDraftService.generate(input));
        progress.claim(progressId,userId);
        try{return Result.success(aiDraftService.generate(input,phase->recordProgress(progressId,userId,phase)));}
        catch(RuntimeException e){recordProgress(progressId,userId,"FAILED");throw e;}
    }
    private void recordProgress(String id,Long owner,String phase){try{progress.phase(id,owner,phase);}catch(RuntimeException ignored){/* Progress failures must not interrupt generation. */}}
}
