package com.tduck.cloud.api.web.controller;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.analysis.*;
import com.tduck.cloud.form.util.FormAuthUtils;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
@RequiredArgsConstructor
@RequestMapping("/user/form/research")
public class AnalysisReportController {
    private final AnalysisReportService reports;
    private final AnalysisSnapshotService snapshots;
    private final ConcurrentHashMap<String,AtomicInteger> rates=new ConcurrentHashMap<>();
    private long minute;
    @ModelAttribute public void noStore(javax.servlet.http.HttpServletResponse response) {response.setHeader("Cache-Control","no-store");}
    private synchronized void limit(Long user,String operation,int maximum) {
        long now=System.currentTimeMillis()/60000;
        if(now!=minute){rates.clear();minute=now;}
        if(rates.size()>4096||rates.computeIfAbsent(user+":"+operation,k->new AtomicInteger()).incrementAndGet()>maximum) throw new BaseException("报告请求过于频繁，请稍后重试；答题与统计不受影响");
    }
    private void check(String key,Integer version) {
        if(key==null||!key.matches("[A-Za-z0-9_-]{1,64}")||version==null||version<1) throw new BaseException("请指定问卷与有效的发布版本");
        FormAuthUtils.hasPermission(key);
    }
    @GetMapping("/status") public Result status(@RequestAttribute Long userId) {return Result.success(reports.status());}
    @GetMapping("/snapshot") public Result snapshot(@RequestParam String formKey,@RequestParam Integer version,@RequestAttribute Long userId) {
        check(formKey,version);limit(userId,"read",120);return Result.success(snapshots.capture(formKey,version));
    }
    @GetMapping("/reports") public Result list(@RequestParam String formKey,@RequestParam Integer version,@RequestAttribute Long userId) {
        check(formKey,version);limit(userId,"read",120);return Result.success(reports.list(formKey,version));
    }
    @GetMapping("/reports/{id}") public Result detail(@PathVariable String id,@RequestAttribute Long userId) {limit(userId,"read",120);return Result.success(reports.detail(id));}
    @PostMapping("/reports") public Result generate(@RequestBody Generate input,@RequestAttribute Long userId) {
        if(!Arrays.asList("LOCAL","REAL").contains(input.mode)) throw new BaseException("请选择本地分组或真实模型");
        if("REAL".equals(input.mode)&&(input.snapshotFingerprint==null||!input.snapshotFingerprint.matches("[a-f0-9]{64}"))) throw new BaseException("请先加载并核对本次生成输入");
        check(input.formKey,input.version);limit(userId,"generate-"+input.mode,"REAL".equals(input.mode)?4:12);
        return Result.success(reports.generate(input.formKey,input.version,input.mode,Boolean.TRUE.equals(input.allowModelTransfer),input.snapshotFingerprint));
    }
    @PostMapping("/reports/{id}/review") public Result review(@PathVariable String id,@RequestBody Review input,@RequestAttribute Long userId) {
        limit(userId,"review",30);if(input.revision==null||input.revision<0) throw new BaseException("审核版本号不正确");
        return Result.success(reports.review(id,input.status,input.revision,input.note,userId));
    }
    @GetMapping("/reports/{id}/export") public ResponseEntity<byte[]> export(@PathVariable String id,@RequestParam(defaultValue="markdown") String format,@RequestAttribute Long userId) {
        limit(userId,"read",120);Map<String,Object> report=reports.detail(id);
        if(!Arrays.asList("json","markdown").contains(format)) throw new BaseException("仅支持Markdown或JSON导出");
        String content="json".equals(format)?AnalysisJson.write(report):AnalysisMarkdown.render(report);
        return ResponseEntity.ok().contentType(new MediaType("json".equals(format)?"application":"text","json".equals(format)?"json":"plain",StandardCharsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=analysis-"+id+("json".equals(format)?".json":".md"))
            .header(HttpHeaders.CACHE_CONTROL,"no-store").body(content.getBytes(StandardCharsets.UTF_8));
    }
    @Data public static class Generate {private String formKey;private Integer version;private String mode="LOCAL";private Boolean allowModelTransfer;private String snapshotFingerprint;}
    @Data public static class Review {private String status;private Integer revision;private String note;}
}
