package com.tduck.cloud.form.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.common.exception.BaseException;
import java.util.*;
import java.util.stream.Collectors;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

/** Only references are accepted from the model. Quotes and all counts come from the snapshot. */
public final class AnalysisOutputValidator {
    private AnalysisOutputValidator() { }
    public static Map<String,Object> validate(String raw,List<Map<String,Object>> evidence) {
        try {
            if(raw==null||raw.length()>100000) throw new IllegalArgumentException();
            String text=raw.trim(); if(text.startsWith("```")) {text=text.replaceFirst("^```(?:json)?\\s*","").replaceFirst("\\s*```$","");}
            int depth=0;boolean quoted=false,escaped=false;
            for(char c:text.toCharArray()) {
                if(escaped){escaped=false;continue;}
                if(quoted&&c=='\\'){escaped=true;continue;}
                if(c=='"'){quoted=!quoted;continue;}
                if(!quoted&&(c=='{'||c=='[')&&++depth>12)throw new IllegalArgumentException();
                if(!quoted&&(c=='}'||c==']'))depth--;
            }
            JsonNode root=JSON.readTree(text); keys(root,"themes","interpretations");
            if(!root.path("themes").isArray()||root.path("themes").size()>12||!root.path("interpretations").isArray()||root.path("interpretations").size()>8) throw new IllegalArgumentException();
            Map<String,Map<String,Object>> index=evidence.stream().collect(Collectors.toMap(e->(String)e.get("id"),e->e));
            List<Map<String,Object>> themes=new ArrayList<>(),interpretations=new ArrayList<>(); Set<String> labels=new HashSet<>();
            for(JsonNode theme:root.path("themes")) {
                keys(theme,"label","evidenceIds"); String label=string(theme,"label",80);
                if(!labels.add(label)) throw new IllegalArgumentException();
                List<String> ids=refs(theme.path("evidenceIds"),index);
                long count=ids.stream().map(id->String.valueOf(index.get(id).get("answerId"))).distinct().count();
                themes.add(map("label",label,"evidenceIds",ids,"supportAnswerCount",count,"classification","MODEL_INFERRED_UNCONFIRMED"));
            }
            for(JsonNode interpretation:root.path("interpretations")) {
                keys(interpretation,"text","evidenceIds"); String message=string(interpretation,"text",800);
                // Numeric conclusions belong exclusively in deterministic backend statistics.
                if(message.matches("(?s).*[0-9%％].*")) throw new IllegalArgumentException();
                interpretations.add(map("text",message,"evidenceIds",refs(interpretation.path("evidenceIds"),index),"classification","MODEL_INFERRED_UNCONFIRMED"));
            }
            if(!evidence.isEmpty()&&themes.isEmpty()) throw new IllegalArgumentException();
            return map("themes",themes,"interpretations",interpretations);
        } catch(Exception e) { throw new BaseException("模型报告未通过结构或证据校验；未保存不可信结果，请重试或使用本地分组"); }
    }
    private static void keys(JsonNode node,String... allowed) {
        if(!node.isObject()) throw new IllegalArgumentException();
        Set<String> names=new HashSet<>(); node.fieldNames().forEachRemaining(names::add);
        if(!names.equals(new HashSet<>(Arrays.asList(allowed)))) throw new IllegalArgumentException();
    }
    private static String string(JsonNode node,String key,int max) {
        if(!node.path(key).isTextual()) throw new IllegalArgumentException();
        String s=node.path(key).asText().trim(); if(s.isEmpty()||s.length()>max) throw new IllegalArgumentException(); return s;
    }
    private static List<String> refs(JsonNode node,Map<String,Map<String,Object>> index) {
        if(!node.isArray()||node.size()==0||node.size()>200) throw new IllegalArgumentException();
        List<String> ids=new ArrayList<>();
        for(JsonNode id:node) {if(!id.isTextual()||!index.containsKey(id.asText())||ids.contains(id.asText())) throw new IllegalArgumentException(); ids.add(id.asText());}
        return ids;
    }
    public static Map<String,Object> local(List<Map<String,Object>> evidence) {
        Map<String,List<Map<String,Object>>> groups=new LinkedHashMap<>();
        for(Map<String,Object> e:evidence) {
            // Keep questions separate; equal text in different questions is not necessarily the same theme.
            String key=e.get("fieldId")+"\u0000"+String.valueOf(e.get("text")).trim();
            groups.computeIfAbsent(key,k->new ArrayList<>()).add(e);
        }
        List<Map<String,Object>> themes=new ArrayList<>();
        groups.values().stream().sorted(Comparator.<List<Map<String,Object>>>comparingInt(List::size).reversed()).limit(12).forEach(group->{
            String text=String.valueOf(group.get(0).get("text")).trim();
            themes.add(map("label",text.length()>60?text.substring(0,60)+"…":text,"evidenceIds",group.stream().map(e->e.get("id")).collect(Collectors.toList()),
                "supportAnswerCount",group.stream().map(e->e.get("answerId")).distinct().count(),"classification","EXACT_TEXT_GROUP"));
        });
        return map("themes",themes,"interpretations",Collections.emptyList());
    }
}
