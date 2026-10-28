package com.tduck.cloud.api.ai;

import com.tduck.cloud.form.ai.OpenAiCompatibleProvider;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import org.junit.Test;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class AssistantNamedOverviewTest {
    private static final String QUESTION="看一下大学生社团参与意愿调查的情况";
    @org.junit.BeforeClass public static void metadata(){org.apache.ibatis.builder.MapperBuilderAssistant b=new org.apache.ibatis.builder.MapperBuilderAssistant(new com.baomidou.mybatisplus.core.MybatisConfiguration(),"named-overview-test");b.setCurrentNamespace(AssistantTurnMapper.class.getName());com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(b,AssistantTurnEntity.class);}
    @Test public void theExactReportedSentenceIsADataRequest(){assertTrue(AssistantPlanner.needsData(QUESTION));}
    @Test public void aScopedOverviewCannotBeAnsweredWithInventedChatFacts(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.complete(any(),any())).thenReturn("{\"tool\":\"chat\",\"arguments\":{\"message\":\"情况很好，共999人。\"}}");Map<String,Object> plan=new AssistantPlanner(p).automatic("看一下这份问卷的情况","owned",1,Collections.emptyList());assertEquals("survey_knowledge",plan.get("tool"));assertFalse(plan.toString().contains("999"));}
    @Test public void namingAnotherSurveyMustNotReuseThePreviousSurvey(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.complete(any(),any())).thenReturn("{\"tool\":\"search_surveys\",\"arguments\":{\"query\":\"大学生社团参与意愿调查\"}}");Map<String,Object> plan=new AssistantPlanner(p).automatic(QUESTION,"previousAiSurvey",2,Collections.emptyList());assertEquals("search_surveys",plan.get("tool"));}
    @Test public void anExactNamedOverviewContinuesIntoKnowledgeRetrieval(){assertSearchContinues(QUESTION);}
    @Test public void aResolvedTitleDoesNotRequireMagicAnalysisKeywords(){assertSearchContinues("大学生社团参与意愿调查");}
    @Test public void aNewNamedSurveyDoesNotInheritThePreviousSurveysVersion(){assertSearchContinues("总结大学生社团参与意愿调查","previousAiSurvey",2);}
    @Test public void ordinaryQuestionsRemainOrdinaryChat(){assertFalse(AssistantPlanner.needsData("如何设计问卷调查"));assertFalse(AssistantPlanner.needsData("看一下天气情况"));}
    private void assertSearchContinues(String question){
        assertSearchContinues(question,null,null);
    }
    private void assertSearchContinues(String question,String previous,Integer previousVersion){
        AssistantTurnMapper turns=mock(AssistantTurnMapper.class);AssistantTools tools=mock(AssistantTools.class);AssistantPlanner planner=mock(AssistantPlanner.class);
        AssistantTurnEntity t=new AssistantTurnEntity();t.setId(UUID.randomUUID().toString());t.setOwnerId(22L);t.setQuestion(question);t.setState("READY");t.setScopeFormKey(previous);t.setScopeVersion(previousVersion);Map<String,Object> args=map("query","大学生社团参与意愿调查");t.setPlanJson(write(map("tool","search_surveys","arguments",args,"automatic",true,"stage",0)));
        when(turns.selectById(t.getId())).thenReturn(t);when(turns.update(any(),any())).thenReturn(1);
        when(tools.call(eq("search_surveys"),any(),eq(22L))).thenReturn(map("kind","surveys","total",1,"surveys",Arrays.asList(map("formKey","clubSurvey","title","大学生社团参与意愿调查"))));
        UserFormEntity f=new UserFormEntity();f.setFormKey("clubSurvey");f.setUserId(22L);when(tools.requireOwned("clubSurvey",22L)).thenReturn(f);
        Map<String,Object> result=new AssistantChatService(mock(AssistantConversationMapper.class),turns,planner,tools).execute(t.getId(),"search_surveys",args,22L);
        assertEquals("surveys",result.get("kind"));verify(tools).requireOwned("clubSurvey",22L);verify(turns,times(2)).update(any(),any());
        org.mockito.ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.Wrapper> changes=org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.Wrapper.class);verify(turns,times(2)).update(any(),changes.capture());com.baomidou.mybatisplus.core.conditions.AbstractWrapper nextUpdate=(com.baomidou.mybatisplus.core.conditions.AbstractWrapper)changes.getValue();if(previousVersion!=null)assertFalse(nextUpdate.getParamNameValuePairs().containsValue(previousVersion));
        Map<String,Object> next=AssistantPlanner.resolvedQuery(question,"clubSurvey",null,"大学生社团参与意愿调查");assertEquals("survey_knowledge",next.get("tool"));assertEquals(question,((Map<?,?>)next.get("arguments")).get("question"));
    }
}
