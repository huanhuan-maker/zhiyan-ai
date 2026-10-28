package com.tduck.cloud.api.ai;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.form.ai.OpenAiCompatibleProvider;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
public class AssistantNaturalReplyTest {
    @Test public void collectionQueriesUseGroundedLlmAnswersInAutomaticChat(){for(String q:Arrays.asList("查一下这份问卷的回收统计","这份问卷有多少份答卷","这份问卷的评分均值是多少")){Map<String,Object> p=new AssistantPlanner(mock(OpenAiCompatibleProvider.class)).automatic(q,"owned",2,Collections.emptyList());assertEquals(q,"survey_knowledge",p.get("tool"));assertEquals(2,((Map<?,?>)p.get("arguments")).get("version"));}}
    @Test public void modelSelectedStatisticsDoNotBypassAnswerGeneration(){OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);when(provider.available()).thenReturn(true);when(provider.complete(any(),any())).thenReturn("{\"tool\":\"survey_stats\",\"arguments\":{\"formKey\":\"owned\"}}");Map<String,Object> p=new AssistantPlanner(provider).automatic("哪个选项的人数最多","owned",null,Collections.emptyList());assertEquals("survey_knowledge",p.get("tool"));assertEquals("哪个选项的人数最多",((Map<?,?>)p.get("arguments")).get("question"));}
    @Test public void uniqueSurveyResolutionRetainsTheActualStatisticalQuestion(){Map<String,Object> p=AssistantPlanner.resolvedQuery("查询“校园调查”的回收统计","owned",1,"校园调查");assertEquals("survey_knowledge",p.get("tool"));assertTrue(((Map<?,?>)p.get("arguments")).get("question").toString().contains("回收统计"));}
    @Test public void explicitChartsRemainCharts(){assertEquals("survey_stats",new AssistantPlanner(mock(OpenAiCompatibleProvider.class)).automatic("给这份问卷画一张柱状图","owned",2,Collections.emptyList()).get("tool"));}
    @Test public void negatedChartRequestsDoNotExpandTheChartPanel(){assertFalse(AssistantPlanner.wantsChart("不用图表，只告诉我回收数"));assertTrue(AssistantPlanner.wantsChart("不要饼图，改成柱状图"));}
    @Test public void vagueFollowupsKeepTheirPreviousQuestionWithoutBecomingAnotherChart(){Map<String,Object> p=new AssistantPlanner(mock(OpenAiCompatibleProvider.class)).automatic("那为什么呢？","owned",2,Arrays.asList(com.tduck.cloud.form.analysis.AnalysisJson.map("user","哪个用途人数最多，请画柱状图","assistant","该选项最常见")));assertEquals("survey_knowledge",p.get("tool"));String question=String.valueOf(((Map<?,?>)p.get("arguments")).get("question"));assertTrue(question.contains("哪个用途人数最多"));assertTrue(question.contains("那为什么呢"));assertTrue(question.length()<=1000);}
    @Test public void switchingAwayFromANegatedChartPreservesThePositiveChartType(){Map<String,Object> p=AssistantPlanner.resolvedQuery("不要饼图，改成柱状图","owned",2,null);assertEquals("bar",((Map<?,?>)p.get("arguments")).get("chartType"));}
}
