package com.tduck.cloud.form.ai;

import cn.hutool.core.util.StrUtil;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tduck.cloud.common.exception.BaseException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * M2 AI 问卷草稿服务：生成 → 解析 → 服务端校验，返回结构化草稿供人工编辑。
 * 本服务不写数据库、不发布问卷；发布复用 M1 版本机制，由用户手动触发。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiDraftService {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final OpenAiCompatibleProvider realProvider;
    private final MockAiProvider mockProvider;

    static final String SYSTEM_PROMPT = "你是严谨的问卷设计助手。根据用户 JSON 输入（goal=调查目标, audience=目标人群, extra=补充说明, questionCount=期望题数）设计问卷草稿。\n"
            + "只输出一个 JSON 对象，禁止输出解释文字、markdown 代码块或其他内容。\n"
            + "若目标足够明确，输出：\n"
            + "{\"kind\":\"draft\",\"title\":\"问卷标题(不超过30字)\",\"description\":\"卷首语(1-2句)\",\"questions\":[{\"type\":\"RADIO|CHECKBOX|RATE|TEXT\",\"label\":\"题干\",\"required\":true,\"options\":[\"选项A\",\"选项B\"],\"rateMax\":5}],\"assumptions\":[\"设计假设\"],\"dimensions\":[\"预设调查维度\"]}\n"
            + "硬性规则：1 questions 数量必须恰好等于 questionCount；2 至少 1 道 type=TEXT 的开放题；3 单选 RADIO 与多选 CHECKBOX 需 2-20 个互斥、不重复、覆盖主要可能的选项；4 RATE 的 rateMax 是 2-10 的整数（不填默认 5）；5 required 为布尔值；6 措辞中立，不得诱导；7 全部使用简体中文，贴合 audience 的语言习惯；8 预设维度放入 dimensions 供人工审核，不写入题目。\n"
            + "若调查目标过于含糊、无法设计出有效问卷，改输出：\n"
            + "{\"kind\":\"clarification\",\"clarification\":[\"需要发起者澄清的问题，最多3条\"],\"assumptions\":[\"初步假设\"]}";

    /** AI 状态（页面展示 Provider/模型/真实或 Mock；不返回任何密钥） */
    public Map<String, Object> status() {
        boolean real = realProvider.available();
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("mode", real ? "REAL" : "MOCK");
        status.put("provider", real ? realProvider.providerName() : mockProvider.providerName());
        status.put("model", real ? realProvider.model() : mockProvider.model());
        status.put("configured", real);
        return status;
    }

    public Map<String, Object> generate(AiDraftInput input) {
        return generate(input, phase -> {});
    }

    public Map<String, Object> generate(AiDraftInput input, java.util.function.Consumer<String> progress) {
        validateInput(input);
        progress.accept("INPUT_VALIDATED");
        boolean real = realProvider.available();
        AiProvider provider = real ? realProvider : mockProvider;
        long startedAt = System.currentTimeMillis();
        String raw;
        try {
            progress.accept(real ? "MODEL_RUNNING" : "MOCK_RUNNING");
            raw = provider.complete(SYSTEM_PROMPT, inputJson(input));
        } catch (AiProviderException e) {
            // 超时/网络/非200等统一转为面向用户的可恢复提示
            log.warn("AI provider degraded: {}", e.getMessage());
            throw new BaseException(e.getMessage());
        }
        progress.accept("VALIDATING");
        AiDraftSpec spec = parse(extractJson(raw));
        AiDraftValidator.Result validation = AiDraftValidator.validate(spec, input.getQuestionCount());
        if (!validation.errors.isEmpty()) {
            // 模型坏输出在此拦截：不允许进入编辑器/保存/发布路径
            log.warn("AI draft rejected by validator: {}", String.join("; ", validation.errors));
            throw new BaseException("AI 草稿未通过服务端校验：" + String.join("；", validation.errors) + "。可重试生成或改用手工建卷");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", spec.getKind().trim().toLowerCase());
        result.put("mode", real ? "REAL" : "MOCK");
        result.put("provider", provider.providerName());
        result.put("model", provider.model());
        result.put("elapsedMs", System.currentTimeMillis() - startedAt);
        result.put("warnings", validation.warnings);
        result.put("assumptions", spec.getAssumptions());
        if ("clarification".equals(result.get("kind"))) {
            result.put("clarification", spec.getClarification());
        } else {
            result.put("title", spec.getTitle().trim());
            result.put("description", StrUtil.nullToEmpty(spec.getDescription()));
            result.put("questions", validation.questions);
            result.put("dimensions", spec.getDimensions());
        }
        progress.accept("clarification".equals(result.get("kind")) ? "CLARIFICATION" : "SUCCEEDED");
        return result;
    }

    private static void validateInput(AiDraftInput input) {
        if (input == null) {
            throw new BaseException("请填写调查需求");
        }
        if (StrUtil.isBlank(input.getGoal()) || input.getGoal().trim().length() > 500) {
            throw new BaseException("调查目标必填且不超过 500 字");
        }
        if (StrUtil.isBlank(input.getAudience()) || input.getAudience().trim().length() > 100) {
            throw new BaseException("目标人群必填且不超过 100 字");
        }
        if (StrUtil.isNotBlank(input.getExtra()) && input.getExtra().trim().length() > 500) {
            throw new BaseException("补充信息不超过 500 字");
        }
        Integer count = input.getQuestionCount();
        if (count == null || count < 1 || count > AiDraftValidator.MAX_QUESTIONS) {
            throw new BaseException("期望题数必须是 1-" + AiDraftValidator.MAX_QUESTIONS + " 的整数");
        }
    }

    private static String inputJson(AiDraftInput input) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("goal", input.getGoal().trim());
        m.put("audience", input.getAudience().trim());
        m.put("extra", StrUtil.nullToEmpty(input.getExtra()).trim());
        m.put("questionCount", input.getQuestionCount());
        try {
            return MAPPER.writeValueAsString(m);
        } catch (Exception e) {
            throw new BaseException("请求组装失败，请重试");
        }
    }

    /** 剥离 markdown 代码块等外壳，截取首个 { 到最后一个 } 之间的 JSON 文本 */
    static String extractJson(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            throw new BaseException("AI 返回了空内容，请重试；不影响手工建卷");
        }
        String text = raw.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new BaseException("AI 返回了无法解析的内容（非 JSON），请重试；不影响手工建卷");
        }
        return text.substring(start, end + 1);
    }

    static AiDraftSpec parse(String json) {
        try {
            return MAPPER.readValue(json, AiDraftSpec.class);
        } catch (Exception e) {
            throw new BaseException("AI 输出的 JSON 无法解析，请重试；不影响手工建卷");
        }
    }
}
