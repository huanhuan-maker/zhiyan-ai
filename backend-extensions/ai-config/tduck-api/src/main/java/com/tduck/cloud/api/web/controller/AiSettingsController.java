package com.tduck.cloud.api.web.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.common.util.*;
import com.tduck.cloud.form.aiconfig.*;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequiredArgsConstructor @RequestMapping("/user/ai-settings")
public class AiSettingsController {
    private final AiSettingsService settings;
    private final AiTransport transport;
    private final AssistantRateLimit rates;
    @ModelAttribute public void guard(javax.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");if(!SecurityUtils.isAdmin())throw new BaseException("仅系统管理员可以管理模型配置");}
    @GetMapping public Result get(){return Result.success(settings.view());}
    @PostMapping public Result save(@RequestBody JsonNode body)throws Exception {
        rates.check(SecurityUtils.getUserId(),"ai-settings-save",20);
        if(body.toString().length()>200000)throw new BaseException("配置过大");
        if(body.has("providers"))for(JsonNode p:body.path("providers"))if(p.has("encryptedKey"))throw new BaseException("不接受客户端加密密钥字段");
        return Result.success(settings.save(AiSettingsService.JSON.treeToValue(body,AiSettings.class),SecurityUtils.getUserId()));
    }
    @PostMapping("/test/{id}") public Result test(@PathVariable String id) {
        rates.check(SecurityUtils.getUserId(),"ai-settings-test",6);
        AiSettingsService.Selection s=settings.byId(id);long started=System.currentTimeMillis();
        try {
            transport.complete(s,"This is a connection test. Reply only OK.","OK");
            Map<String,Object> r=new LinkedHashMap<>();r.put("success",true);r.put("model",s.model.getModelId());r.put("protocol",s.provider.getProtocol());r.put("elapsedMs",System.currentTimeMillis()-started);return Result.success(r);
        } catch(com.tduck.cloud.form.ai.AiProviderException e){throw new BaseException(e.getMessage());}
    }
}
