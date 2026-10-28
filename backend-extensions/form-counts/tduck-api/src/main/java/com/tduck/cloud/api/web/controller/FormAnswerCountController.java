package com.tduck.cloud.api.web.controller;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.tduck.cloud.common.util.Result;
import com.tduck.cloud.form.entity.UserFormDataEntity;
import com.tduck.cloud.form.entity.UserFormEntity;
import com.tduck.cloud.form.service.UserFormDataService;
import com.tduck.cloud.form.service.UserFormService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 我的问卷卡片需要的收集份数：一次请求返回当前页所有问卷的答卷数，
 * 避免卡片逐个请求统计接口。只返回当前用户自己的问卷，未拥有的 key 直接忽略。
 *
 * @author zhiyan
 */
@RestController
@RequiredArgsConstructor
public class FormAnswerCountController {

    /** 单次最多查询的问卷数，与前端分页上限保持一致 */
    private static final int MAX_KEYS = 100;

    private final UserFormService formService;
    private final UserFormDataService userFormDataService;

    @GetMapping("/user/form/answer-counts")
    public Result answerCounts(@RequestAttribute Long userId, @RequestParam("keys") String keys) {
        List<String> requested = new ArrayList<>();
        for (String part : StrUtil.nullToEmpty(keys).split(",")) {
            String key = part.trim();
            if (StrUtil.isNotBlank(key) && !requested.contains(key)) {
                requested.add(key);
            }
        }
        if (requested.isEmpty()) {
            return Result.success(Collections.emptyMap());
        }
        if (requested.size() > MAX_KEYS) {
            return Result.failed("一次最多查询 " + MAX_KEYS + " 份问卷");
        }
        Set<String> owned = formService.list(Wrappers.<UserFormEntity>lambdaQuery()
                        .eq(UserFormEntity::getUserId, userId)
                        .eq(UserFormEntity::getDeleted, false)
                        .in(UserFormEntity::getFormKey, requested))
                .stream().map(UserFormEntity::getFormKey).collect(Collectors.toSet());
        Map<String, Long> result = new LinkedHashMap<>();
        if (!owned.isEmpty()) {
            List<Map<String, Object>> rows = userFormDataService.listMaps(Wrappers.<UserFormDataEntity>query()
                    .select("form_key AS form_key", "COUNT(1) AS answer_count")
                    .in("form_key", owned)
                    .groupBy("form_key"));
            Map<String, Long> counts = new HashMap<>();
            for (Map<String, Object> row : rows) {
                Object key = row.get("form_key");
                Object count = row.get("answer_count");
                if (key != null && count instanceof Number) {
                    counts.put(String.valueOf(key), ((Number) count).longValue());
                }
            }
            for (String key : requested) {
                if (owned.contains(key)) {
                    result.put(key, counts.getOrDefault(key, 0L));
                }
            }
        }
        return Result.success(result);
    }
}
