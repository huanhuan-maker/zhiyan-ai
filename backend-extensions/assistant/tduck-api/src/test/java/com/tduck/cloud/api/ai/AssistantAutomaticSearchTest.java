package com.tduck.cloud.api.ai;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import org.junit.Test;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
public class AssistantAutomaticSearchTest {
    @org.junit.BeforeClass public static void metadata(){org.apache.ibatis.builder.MapperBuilderAssistant b=new org.apache.ibatis.builder.MapperBuilderAssistant(new com.baomidou.mybatisplus.core.MybatisConfiguration(),"automatic-search-test");b.setCurrentNamespace(AssistantTurnMapper.class.getName());com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(b,AssistantTurnEntity.class);}
    private Map<String,Object> execute(String question){
        AssistantTurnMapper turns=mock(AssistantTurnMapper.class);AssistantTools tools=mock(AssistantTools.class);
        AssistantTurnEntity t=new AssistantTurnEntity();t.setId(UUID.randomUUID().toString());t.setOwnerId(22L);t.setQuestion(question);t.setState("READY");t.setPlanJson(write(map("tool","search_surveys","arguments",map("query",""),"automatic",true,"stage",0)));
        when(turns.selectById(t.getId())).thenReturn(t);when(turns.update(any(),any())).thenReturn(1);
        when(tools.call(eq("search_surveys"),any(),eq(22L))).thenReturn(map("kind","surveys","total",2,"message","请选择一份后继续查询。","surveys",Arrays.asList(map("formKey","one","title","校园调查"),map("formKey","two","title","食堂调查"))));
        return new AssistantChatService(mock(AssistantConversationMapper.class),turns,mock(AssistantPlanner.class),tools).execute(t.getId(),"search_surveys",map("query",""),22L);
    }
    @Test public void ambiguousAnalysisDoesNotDumpSurveySelectionCards(){Map<String,Object> r=execute("帮我分析一下问卷");assertEquals("chat",r.get("kind"));assertFalse(r.containsKey("surveys"));assertFalse(r.get("message").toString().contains("请选择"));}
    @Test public void catalogueCountIsAConciseChatReplyRatherThanSelectionCards(){Map<String,Object> r=execute("我现在有多少份问卷");assertEquals("chat",r.get("kind"));assertTrue(r.get("message").toString().contains("2"));assertFalse(r.containsKey("surveys"));}
    @Test public void exactNamedSurveyResolvesWithoutGuessingOrCallingAModel(){com.tduck.cloud.form.ai.OpenAiCompatibleProvider provider=mock(com.tduck.cloud.form.ai.OpenAiCompatibleProvider.class);assertEquals("one",new AssistantPlanner(provider).chooseSurvey("总结校园调查的答卷",Arrays.asList(map("formKey","one","title","校园调查"),map("formKey","two","title","食堂调查"))));verifyNoInteractions(provider);}
    @Test public void modelCanResolveATopicOnlyToAnAllowedCandidate(){com.tduck.cloud.form.ai.OpenAiCompatibleProvider provider=mock(com.tduck.cloud.form.ai.OpenAiCompatibleProvider.class);when(provider.available()).thenReturn(true);when(provider.complete(any(),any())).thenReturn("{\"formKey\":\"two\"}","{\"formKey\":\"foreign\"}","{\"formKey\":null}");AssistantPlanner planner=new AssistantPlanner(provider);List<Map<String,Object>> found=Arrays.asList(map("formKey","one","title","校园调查"),map("formKey","two","title","食堂调查"));assertEquals("two",planner.chooseSurvey("总结饭菜反馈",found));assertNull(planner.chooseSurvey("读其他账号",found));assertNull(planner.chooseSurvey("分析问卷",found));}
}
