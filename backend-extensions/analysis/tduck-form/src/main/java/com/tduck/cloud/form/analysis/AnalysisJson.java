package com.tduck.cloud.form.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tduck.cloud.common.exception.BaseException;
import java.util.*;

public final class AnalysisJson {
    public static final ObjectMapper JSON = new ObjectMapper()
        .enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private AnalysisJson() { }
    public static String write(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception e) { throw new BaseException("报告数据无法序列化"); }
    }
    public static Map<String,Object> read(String value) {
        try { return JSON.readValue(value, LinkedHashMap.class); }
        catch (Exception e) { throw new BaseException("报告结构不正确，请重新生成"); }
    }
    public static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
}
