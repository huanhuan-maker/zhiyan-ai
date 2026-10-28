package com.tduck.cloud.api.ai;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.common.exception.BaseException;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
public class SurveyKnowledgeTest {
    @Test public void summaryReadsKnowledgeInsteadOfDraftQuestions(){for(String text:Arrays.asList("你给我总结一下这个问卷","分析这份调查的主要反馈","学生为什么不愿意参与？")){assertEquals(text,"survey_knowledge",AssistantPlanner.local(text,"owned",2).get("tool"));}}
    @Test public void knowledgeArgumentsCannotEscapeOwnerOrInjectOtherProperties(){try{AssistantTools.validateArguments("survey_knowledge",map("formKey","owned","question","总结","sql","SELECT"));fail();}catch(BaseException expected){}}
    @Test public void citationsMustActuallyExist(){try{SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"结论\",\"refs\":[\"fake\"]}]}",Arrays.asList(map("id","A1","text","原文")));fail();}catch(BaseException expected){}}
    @Test public void newNumericFactsAreRejected(){try{SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"占99.99%\",\"refs\":[\"S1\"]}]}",Arrays.asList(map("id","S1","text","有效35份")));fail();}catch(BaseException expected){}}
    @Test public void naturalGroundedParagraphSurvives(){assertEquals(1,SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"部分入选回答提及时间安排，建议进一步核查活动时段。\",\"refs\":[\"A1\"]}]}",Arrays.asList(map("id","A1","text","课程时间冲突"))).size());}
    @Test public void citationIdentifiersInsideProseAreNotInventedStatistics(){assertEquals(1,SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"入选回答提到时间冲突（A123）。\",\"refs\":[\"A123\"]}]}",Arrays.asList(map("id","A123","text","课程时间冲突"))).size());}
    @Test public void equivalentDecimalRepresentationsAreTheSameStatistic(){assertEquals(1,SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"占100%\",\"refs\":[\"S1\"]}]}",Arrays.asList(map("id","S1","statistics",map("percent",100.0)))).size());}
    @Test public void distinctCitedRespondentsSupportAnEvidenceCount(){assertEquals(1,SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"这2份入选答卷分别提及时间和距离。\",\"refs\":[\"A1\",\"A2\"]}]}",Arrays.asList(map("id","A1","answerId","one","text","时间"),map("id","A2","answerId","two","text","距离"))).size());}
    @Test public void repeatedFieldsFromOneRespondentCannotBeCountedAsTwoPeople(){try{SurveyKnowledgeService.validate("{\"findings\":[{\"text\":\"这2人\",\"refs\":[\"A1\",\"A2\"]}]}",Arrays.asList(map("id","A1","answerId","one","text","时间"),map("id","A2","answerId","one","text","距离")));fail();}catch(BaseException expected){}}
    @Test public void contextBudgetSelectsWholePassagesWithoutSilentlyTruncatingText(){String longText=String.join("",Collections.nCopies(2000,"长"));List<Map<String,Object>> chosen=SurveyKnowledgeService.budgetedSources(Arrays.asList(map("id","S0","kind","statistics","text","35份"),map("id","A1","kind","answer","text",longText),map("id","A2","kind","answer","text","课程时间冲突")),"时间",300);assertTrue(chosen.stream().anyMatch(s->"S0".equals(s.get("id"))));assertFalse(chosen.stream().anyMatch(s->"A1".equals(s.get("id"))));assertEquals("课程时间冲突",chosen.stream().filter(s->"A2".equals(s.get("id"))).findFirst().get().get("text"));}
    @Test public void identifiersAreRedacted(){String text=SurveyKnowledgeService.redact("邮箱demo@example.test 电话13800138000 证件110101199001011234");assertFalse(text.contains("demo@example.test"));assertFalse(text.contains("13800138000"));assertFalse(text.contains("110101199001011234"));}
    @Test public void retrievalPrioritizesRelatedTextAndKeepsDistinctVoices(){List<Map<String,Object>> docs=Arrays.asList(map("id","a","question","困难","text","没有兴趣"),map("id","b","question","困难","text","时间冲突无法参加"),map("id","c","question","困难","text","[模拟测试 01]没有兴趣"));List<Map<String,Object>> found=SurveyKnowledgeService.retrieve(docs,"时间冲突",12);assertEquals("b",found.get(0).get("id"));assertEquals(2,found.size());}
}
