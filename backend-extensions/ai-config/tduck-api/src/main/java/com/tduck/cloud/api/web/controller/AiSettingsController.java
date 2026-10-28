package com.tduck.cloud.api.web.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.common.util.*;
import com.tduck.cloud.form.aiconfig.*;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletResponse;
import java.util.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/user/ai-settings")
public class AiSettingsController {
    private final AiSettingsService settings;
    private final AiTransport transport;
    private final AssistantRateLimit rates;

    @ModelAttribute public void noStore(HttpServletResponse response){response.setHeader("Cache-Control","no-store");}

    // ===== 系统默认配置（仅管理员） =====

    @GetMapping public Result get(){requireAdmin();return Result.success(settings.view());}

    @PostMapping public Result save(@RequestBody JsonNode body)throws Exception {
        requireAdmin();
        return Result.success(settings.save(body(body),SecurityUtils.getUserId()));
    }

    @PostMapping("/test/{id}") public Result test(@PathVariable String id) {
        requireAdmin();
        return Result.success(testConnection(settings.byId(id),SecurityUtils.getUserId(),"ai-settings-test"));
    }

    // ===== 每个用户自己的配置：自己的请求地址 + 自己的 API Key =====

    @GetMapping("/mine") public Result mine(){return Result.success(settings.viewOwn(SecurityUtils.getUserId()));}

    @PostMapping("/mine") public Result saveMine(@RequestBody JsonNode body)throws Exception {
        return Result.success(settings.saveOwn(body(body),SecurityUtils.getUserId()));
    }

    @PostMapping("/mine/test/{id}") public Result testMine(@PathVariable String id) {
        return Result.success(testConnection(settings.byId(id,SecurityUtils.getUserId()),SecurityUtils.getUserId(),"ai-settings-test-mine"));
    }

    private AiSettings body(JsonNode body)throws Exception {
        rates.check(SecurityUtils.getUserId(),"ai-settings-save",20);
        if(body==null)throw new BaseException("配置内容不能为空");
        if(body.toString().length()>200000)throw new BaseException("配置过大");
        if(body.has("providers"))for(JsonNode p:body.path("providers"))if(p.has("encryptedKey"))throw new BaseException("不接受客户端加密密钥字段");
        return AiSettingsService.JSON.treeToValue(body,AiSettings.class);
    }

    private Map<String,Object> testConnection(AiSettingsService.Selection s,Long actor,String rateKey) {
        rates.check(actor,rateKey,6);
        long started=System.currentTimeMillis();
        try {
            transport.complete(s,"This is a connection test. Reply only OK.","OK");
            Map<String,Object> r=new LinkedHashMap<>();r.put("success",true);r.put("model",s.model.getModelId());r.put("protocol",s.provider.getProtocol());r.put("elapsedMs",System.currentTimeMillis()-started);return r;
        } catch(com.tduck.cloud.form.ai.AiProviderException e){throw new BaseException(e.getMessage());}
    }

    private static void requireAdmin(){if(!SecurityUtils.isAdmin())throw new BaseException("仅系统管理员可以管理系统默认模型配置");}
}
