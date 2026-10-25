package com.tduck.cloud.form.analysis;

import java.util.*;

/** Exports facts independently from model interpretations; all untrusted text is escaped. */
public final class AnalysisMarkdown {
    private AnalysisMarkdown() { }
    public static String text(Object value) {
        String s=String.valueOf(value==null?"":value).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\r","").replace("\n"," / ");
        for(String c:Arrays.asList("\\","`","*","_","[","]","(",")","#","|","!")) s=s.replace(c,"\\"+c);
        return s;
    }
    public static String render(Map<String,Object> report) {
        Map<String,Object> snapshot=(Map<String,Object>)report.get("snapshot"),output=(Map<String,Object>)report.get("output");
        StringBuilder b=new StringBuilder("# 问卷分析报告\n\n");
        b.append(text(snapshot.get("title"))).append("\n\n版本：V").append(report.get("versionNo")).append("；问卷：").append(text(report.get("formKey")))
            .append("；报告编号：").append(text(report.get("id"))).append("\n\n生成时间（UTC）：").append(text(report.get("createdAt")))
            .append("\n\n审核状态：").append(text(report.get("status"))).append("；数据变化：").append(Boolean.TRUE.equals(report.get("dataChanged"))?"已变化或无法核对，请重新生成":"与快照一致")
            .append("\n\n来源：").append(text(report.get("provider"))).append("；模型/算法：").append(text(report.get("model")))
            .append("\n\n审核说明：").append(text(report.get("reviewNote"))).append("\n\n## 后端计算事实\n\n版本答卷：").append(snapshot.get("answerCount"))
            .append(" 份。每题有效/缺失按该题计算；缺失含未答或无效值，有条件显隐题不能外推总体比例。\n\n");
        for(Map<String,Object> q:(List<Map<String,Object>>)snapshot.get("statistics")) {
            b.append("### ").append(text(q.get("label"))).append("\n\n题目编号：").append(text(q.get("fieldId"))).append("；有效：").append(q.get("validCount"))
                .append("；缺失：").append(q.get("missingCount")).append("；总答卷：").append(q.get("totalCount")).append("\n\n");
            if(q.get("mean")!=null) b.append("量表均值：").append(q.get("mean")).append("\n\n");
            Map<String,Object> counts=(Map<String,Object>)q.get("map"),percentages=(Map<String,Object>)q.get("percentages");
            if(counts!=null&&!counts.isEmpty()) {
                b.append("| 选项 | 人数 | 占本题有效人数 |\n| --- | ---: | ---: |\n");
                counts.forEach((k,v)->b.append("| ").append(text(k)).append(" | ").append(v).append(" | ").append(percentages.get(k)).append("% |\n"));
                b.append("\n多选比例合计可超过百分之百。\n\n");
            }
        }
        b.append("## 候选归纳与解释（需人工复核）\n\n核心开放回答 ").append(snapshot.get("openResponseCount")).append(" 条，入选 ").append(snapshot.get("includedEvidenceCount"))
            .append(" 条，排除 ").append(snapshot.get("excludedEvidenceCount")).append(" 条；覆盖不同答卷 ").append(snapshot.get("coveredAnswerCount"))
            .append(" 份。按答卷编号和题目顺序入选，最多二百条/六万字，单条超过两千字不入选。主题计数仅是列出的证据中不同答卷数，不能作为总体比例。核心开放回答的自发性未经判定。\n\n");
        if("LOCAL".equals(report.get("mode"))) b.append("本地结果只是同题相同文本分组，最多十二组，不是语义主题或大模型结果。\n\n");
        for(Map<String,Object> theme:(List<Map<String,Object>>)output.get("themes")) b.append("- ").append(text(theme.get("label"))).append("；证据答卷数：").append(theme.get("supportAnswerCount"))
            .append("；来源：").append(text(theme.get("classification"))).append("；证据：").append(text(theme.get("evidenceIds"))).append("\n");
        for(Map<String,Object> interpretation:(List<Map<String,Object>>)output.get("interpretations")) b.append("\n模型解释（待核实）：").append(text(interpretation.get("text"))).append("；证据：").append(text(interpretation.get("evidenceIds"))).append("\n");
        b.append("\n## 原文证据快照\n\n");
        for(Map<String,Object> e:(List<Map<String,Object>>)snapshot.get("evidence")) b.append("### ").append(e.get("id")).append("\n\n问卷 ").append(text(report.get("formKey"))).append(" / V").append(report.get("versionNo"))
            .append(" / 题目 ").append(text(e.get("fieldId"))).append(" / 答卷 ").append(text(e.get("answerId"))).append("\n\n题干：").append(text(e.get("question")))
            .append("\n\n原文：").append(text(e.get("text"))).append("\n\n来源：").append(text(e.get("attribution"))).append("\n\n");
        b.append("## 审核历史\n\n");
        for(Map<String,Object> a:(List<Map<String,Object>>)report.get("reviews")) b.append("- ").append(text(a.get("createdAt"))).append(" · ").append(text(a.get("status"))).append(" · ").append(text(a.get("note"))).append("\n");
        return b.append("\n本报告不证明抽样代表性、因果关系或统计显著性。模型解释及其证据语义须由审核人核实。\n").toString();
    }
}
