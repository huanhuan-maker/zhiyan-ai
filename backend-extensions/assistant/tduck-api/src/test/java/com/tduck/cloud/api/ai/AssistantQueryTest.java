package com.tduck.cloud.api.ai;

import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.entity.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.service.UserFormVersionService;
import com.tduck.cloud.form.analysis.AnalysisSnapshotService;
import com.tduck.cloud.api.web.filter.AssistantMcpFilter;
import org.junit.Test;
import java.util.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

public class AssistantQueryTest {
    private static final String PLAN="{\"tool\":\"survey_stats\",\"arguments\":{\"formKey\":\"owned\",\"version\":1}}";
    private void rejected(String raw,String key){try{AssistantPlanner.parse(raw,key,null);fail("untrusted plan accepted");}catch(Exception expected){}}
    @Test public void acceptsReadPlanButPinsSelectedVersion(){Map<String,Object> p=AssistantPlanner.parse(PLAN,"owned",2);assertEquals(2,((Map<?,?>)p.get("arguments")).get("version"));}
    @Test public void integralJsonNumbersUseCanonicalTypesForIdempotentToolCalls(){Map<String,Object> p=AssistantPlanner.parse(PLAN.replace("\"version\":1","\"version\":1.0"),"owned",null);assertEquals(1,((Map<?,?>)p.get("arguments")).get("version"));assertEquals(map("limit",5),AssistantTools.normalizedArguments("search_surveys",map("limit",5.0)));}
    @Test public void foreignScopeCannotBeIntroducedByModel(){rejected(PLAN,"other");}
    @Test public void unknownWriteToolRejected(){rejected(PLAN.replace("survey_stats","delete_survey"),"owned");}
    @Test public void ownerAndSqlArgumentsRejected(){rejected(PLAN.replace("\"version\":1","\"userId\":1"),"owned");rejected(PLAN.replace("\"version\":1","\"sql\":\"select *\""),"owned");}
    @Test public void noScopeCannotReadAnArbitrarySurvey(){rejected(PLAN,null);}
    @Test public void extraReplyFieldsRejected(){rejected(PLAN.replace("{\"tool\":","{\"answer\":\"999人\",\"tool\":"),"owned");}
    @Test public void duplicateAndTrailingJsonRejected(){rejected(PLAN+"{}","owned");rejected(PLAN.replace("{\"tool\":","{\"tool\":\"none\",\"tool\":"),"owned");}
    @Test public void deeplyNestedOutputRejected(){rejected(String.join("",Collections.nCopies(100,"["))+"0"+String.join("",Collections.nCopies(100,"]")),"owned");}
    @Test public void keywordLimitsAndEmptyValuesRejected(){for(Object keywords:Arrays.asList(Collections.emptyList(),Arrays.asList(""),Arrays.asList("a","b","c","d","e","f","g"))){try{AssistantTools.validateArguments("search_answers",map("formKey","owned","keywords",keywords));fail();}catch(BaseException expected){}}}
    @Test public void numericArgumentsMustBeBoundedIntegers(){for(Object n:Arrays.asList(-1,100,1.5,"5")){try{AssistantTools.validateArguments("search_surveys",map("limit",n));fail();}catch(BaseException expected){}}}
    @Test public void localQueriesAreLabelledAndPreserveLiteralQuotedKeyword(){Map<String,Object> p=AssistantPlanner.local("查找提到“排队”的回答","owned",1);assertEquals("search_answers",p.get("tool"));assertEquals(Collections.singletonList("排队"),((Map<?,?>)p.get("arguments")).get("keywords"));}
    @Test public void unsupportedWritesRemainNonExecutable(){assertEquals("none",AssistantPlanner.local("帮我删除全部问卷","owned",1).get("tool"));}
    @Test public void modelTimeoutDegradesWithoutBlockingLocalQueries(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.complete(any(),any())).thenThrow(new AiProviderException("synthetic timeout"));Map<String,Object> result=new AssistantPlanner(p).plan("回收数多少","owned",1,true,true);assertEquals("DEGRADED",result.get("mode"));assertEquals("survey_stats",result.get("tool"));}
    @Test public void invalidModelPlanDegradesRatherThanExecutingUnknownTool(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.complete(any(),any())).thenReturn(PLAN.replace("survey_stats","delete_survey"));assertEquals("DEGRADED",new AssistantPlanner(p).plan("回收数多少","owned",1,true,true).get("mode"));}
    @Test public void absentTransferConsentNeverCallsModel(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);try{new AssistantPlanner(p).plan("问题","owned",1,true,false);fail();}catch(BaseException expected){}verifyNoInteractions(p);}
    @Test public void validRealPlannerRemainsClearlyIdentified(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.complete(any(),any())).thenReturn(PLAN);when(p.model()).thenReturn("synthetic-planner");Map<String,Object> result=new AssistantPlanner(p).plan("回收数多少","owned",1,true,true);assertEquals("REAL",result.get("mode"));assertEquals("synthetic-planner",result.get("model"));}
    private AssistantTools tools(UserFormMapper forms,UserFormDataMapper answers,UserFormVersionService versions){return new AssistantTools(forms,answers,versions,mock(AnalysisSnapshotService.class),mock(AnalysisReportMapper.class));}
    @Test public void evenAdministratorIdCannotReadOtherOwnersThroughAssistant(){UserFormMapper forms=mock(UserFormMapper.class);UserFormEntity f=new UserFormEntity();f.setUserId(22L);when(forms.selectOne(any())).thenReturn(f);try{tools(forms,mock(UserFormDataMapper.class),mock(UserFormVersionService.class)).requireOwned("owned",1L);fail();}catch(BaseException expected){}}
    @Test public void archivedSurveyIsNotAnAssistantSource(){UserFormMapper forms=mock(UserFormMapper.class);UserFormEntity f=new UserFormEntity();f.setUserId(22L);f.setDeleted(true);when(forms.selectOne(any())).thenReturn(f);try{tools(forms,mock(UserFormDataMapper.class),mock(UserFormVersionService.class)).requireOwned("owned",22L);fail();}catch(BaseException expected){}}
    @Test public void keywordSearchScansBeyondReportEvidenceLimitAndCountsFullMatches(){
        UserFormMapper forms=mock(UserFormMapper.class);UserFormDataMapper answers=mock(UserFormDataMapper.class);UserFormVersionService versions=mock(UserFormVersionService.class);
        UserFormEntity f=new UserFormEntity();f.setUserId(22L);when(forms.selectOne(any())).thenReturn(f);
        UserFormVersionEntity v=new UserFormVersionEntity().setVersionNo(1);when(versions.latest("owned")).thenReturn(v);
        UserFormItemEntity q=new UserFormItemEntity();q.setFormItemId("q");q.setLabel("体验");q.setType(com.tduck.cloud.form.entity.enums.FormItemTypeEnum.TEXTAREA);when(versions.itemsOf(v)).thenReturn(Collections.singletonList(q));
        List<UserFormDataEntity> rows=new ArrayList<>();for(int i=0;i<205;i++){UserFormDataEntity r=new UserFormDataEntity();r.setId((long)i);r.setOriginalData(map("q",i>=200?"排队很久":"其他体验"));rows.add(r);}when(answers.selectList(any())).thenReturn(rows);
        Map<String,Object> result=tools(forms,answers,versions).call("search_answers",map("formKey","owned","keywords",Collections.singletonList("排队"),"limit",2),22L);
        assertEquals(5,result.get("matchedResponseCount"));assertEquals(5,result.get("matchedAnswerCount"));assertEquals(2,result.get("returnedEvidenceCount"));assertEquals(205,result.get("scannedAnswerCount"));assertEquals("KEYWORD_LITERAL",result.get("retrievalMode"));
    }
    @Test public void mcpDiscoveryExposesQueriesAndPreviewsWithoutAConfirmationTool(){AssistantMcpProtocol p=new AssistantMcpProtocol(mock(AssistantTools.class),mock(AssistantChatService.class));Map<String,Object> init=p.handle(map("jsonrpc","2.0","id",1,"method","initialize","params",map("protocolVersion","2026-07-28","capabilities",map(),"clientInfo",map("name","test","version","1"))),22L,null);assertEquals("2025-06-18",((Map<?,?>)init.get("result")).get("protocolVersion"));Map<String,Object> list=p.handle(map("jsonrpc","2.0","id",2,"method","tools/list"),22L,AssistantMcpProtocol.VERSION);List<Map<String,Object>> defs=(List<Map<String,Object>>)((Map<?,?>)list.get("result")).get("tools");assertEquals(10,defs.size());assertTrue(defs.stream().allMatch(d->Boolean.TRUE.equals(((Map<?,?>)d.get("annotations")).get("readOnlyHint"))));}
    @Test public void mcpRejectsUnknownMethodWrongVersionAndWriteTool(){AssistantMcpProtocol p=new AssistantMcpProtocol(mock(AssistantTools.class),mock(AssistantChatService.class));assertTrue(p.handle(map("jsonrpc","2.0","id",1,"method","tools/list"),22L,"wrong").containsKey("error"));assertTrue(p.handle(map("jsonrpc","2.0","id",1,"method","unknown"),22L,AssistantMcpProtocol.VERSION).containsKey("error"));assertTrue(p.handle(map("jsonrpc","2.0","id",1,"method","tools/call","params",map("name","delete_survey","arguments",map())),22L,AssistantMcpProtocol.VERSION).containsKey("error"));}
    @Test public void initializedNotificationHasNoJsonRpcReply(){assertNull(new AssistantMcpProtocol(mock(AssistantTools.class),mock(AssistantChatService.class)).handle(map("jsonrpc","2.0","method","notifications/initialized"),22L,AssistantMcpProtocol.VERSION));}
    @Test public void transportRejectsDeepStructuresButIgnoresBracesInsideQuotedData(){assertFalse(AssistantMcpFilter.withinDepth(String.join("",Collections.nCopies(2000,"["))));assertTrue(AssistantMcpFilter.withinDepth(write(map("text",String.join("",Collections.nCopies(100,"["))))));}
}
