package com.tduck.cloud.api.ai;

import com.tduck.cloud.form.assistant.*;
import com.tduck.cloud.common.exception.BaseException;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
import com.tduck.cloud.form.mapper.*;
import com.tduck.cloud.form.entity.AssistantTurnEntity;
import com.tduck.cloud.form.ai.OpenAiCompatibleProvider;
import static org.mockito.Mockito.*;

public class AssistantWorkspaceTest {
    private void reject(Runnable fn){try{fn.run();fail("Untrusted input accepted");}catch(BaseException|IllegalArgumentException expected){}}
    @Test public void scopeCannotBeInventedForManagement(){reject(()->AssistantPlanner.parseAutomatic("{\"tool\":\"manage_survey\",\"arguments\":{\"action\":\"PUBLISH\",\"formKey\":\"foreign\"}}","owned",null));}
    @Test public void creationDoesNotNeedOrAcceptAnExistingScope(){assertEquals("manage_survey",AssistantPlanner.parseAutomatic("{\"tool\":\"manage_survey\",\"arguments\":{\"action\":\"CREATE\",\"title\":\"新问卷\"}}",null,null).get("tool"));reject(()->AssistantWorkspace.validate(map("action","CREATE","title","x","formKey","owned")));}
    @Test public void confirmationIsNotAModelTool(){reject(()->AssistantTools.validateArguments("confirm_action",map()));reject(()->AssistantWorkspace.validate(map("action","PUBLISH","formKey","owned","confirmed",true)));}
    @Test public void unsupportedPrivilegesAndPermanentDeletionAreRejected(){for(String action:Arrays.asList("DELETE","SQL","SET_ADMIN","CHANGE_PROVIDER"))reject(()->AssistantWorkspace.validate(map("action",action,"formKey","owned")));}
    @Test public void optionsMustBeDistinctAndCorrectlyTyped(){reject(()->AssistantWorkspace.normalizedQuestions(Arrays.asList(map("type","RADIO","label","q","options",Arrays.asList("a","a")))));reject(()->AssistantWorkspace.normalizedQuestions(Arrays.asList(map("type","RADIO","label","q","options",Arrays.asList(1,2)))));}
    @Test public void ratingAndBooleanInputsHaveStrictLimits(){reject(()->AssistantWorkspace.normalizedQuestions(Arrays.asList(map("type","RATE","label","q","rateMax",999))));reject(()->AssistantWorkspace.normalizedQuestions(Arrays.asList(map("type","TEXT","label","q","required","yes"))));}
    @Test public void questionChangesCannotSmuggleSqlOrConfirmation(){reject(()->AssistantWorkspace.validate(map("action","EDIT_QUESTION","formKey","owned","questionNo",1,"question",map("sql","drop table x"))));reject(()->AssistantWorkspace.validate(map("action","MOVE_QUESTION","formKey","owned","questionNo",1,"toPosition",1.5)));}
    @Test public void managementDoesNotAcceptHistoricalVersions(){reject(()->AssistantTools.validateArguments("manage_survey",map("action","PUBLISH","formKey","owned","version",1)));Map<String,Object> p=AssistantPlanner.parseAutomatic("{\"tool\":\"manage_survey\",\"arguments\":{\"action\":\"STOP\",\"formKey\":\"owned\"}}","owned",2);assertFalse(((Map<?,?>)p.get("arguments")).containsKey("version"));}
    @Test public void offlineQueriesSupportChartsSharingExportsAndVersionLists(){assertEquals("survey_stats",AssistantPlanner.local("分析这份调查并出图","owned",1).get("tool"));assertEquals("survey_export",AssistantPlanner.local("导出答卷","owned",1).get("tool"));assertEquals("survey_share",AssistantPlanner.local("分享链接","owned",1).get("tool"));assertEquals("survey_versions",AssistantPlanner.local("版本列表","owned",1).get("tool"));}
    @Test public void numberedEditsHaveARestrictedPartialSchema(){Map<String,Object> args=map("action","EDIT_QUESTION","formKey","owned","questionNo",2,"question",map("label","新的题干","required",false));AssistantWorkspace.validate(args);reject(()->AssistantWorkspace.validate(map("action","REMOVE_QUESTION","formKey","owned","questionNo",0)));}
    @Test public void generatingAChartMustNeverBeMisroutedToQuestionnaireDesign(){for(String q:Arrays.asList("生成基于这份问卷的数据图","基于这份问卷出一个数据图","给这个调查画张饼图","用当前问卷生成柱状图")){assertEquals(q,"survey_stats",AssistantPlanner.local(q,"owned",null).get("tool"));assertTrue(q,AssistantPlanner.needsData(q));}}
    @Test public void chartRequestsSearchTheQuotedSurveyNameInsteadOfTheWholeInstruction(){Map<String,Object> p=AssistantPlanner.local("基于“食堂满意度”的问卷生成一个数据图",null,null);assertEquals("search_surveys",p.get("tool"));assertEquals("食堂满意度",((Map<?,?>)p.get("arguments")).get("query"));}
    @Test public void chartTypeAndQuestionSelectionSurviveUniqueSurveyResolution(){Map<String,Object> p=AssistantPlanner.resolvedQuery("基于“食堂满意度”问卷，把“餐食评价”画成饼图","owned",1,"食堂满意度");assertEquals("survey_stats",p.get("tool"));assertEquals("donut",((Map<?,?>)p.get("arguments")).get("chartType"));assertEquals("餐食评价",((Map<?,?>)p.get("arguments")).get("fieldQuery"));}
    @Test public void confirmationReplaysLockedResultInsteadOfStalePreLockProposal(){
        String id=UUID.randomUUID().toString();AssistantTurnMapper turns=mock(AssistantTurnMapper.class);AssistantActionMapper actions=mock(AssistantActionMapper.class);AssistantWorkspace workspace=mock(AssistantWorkspace.class);
        AssistantTurnEntity stale=new AssistantTurnEntity();stale.setOwnerId(22L);stale.setState("SUCCEEDED");stale.setResultJson(write(map("kind","action_proposal")));when(turns.selectById(id)).thenReturn(stale);
        Map<String,Object> result=map("kind","action_result","formKey","created-once");AssistantTurnEntity current=new AssistantTurnEntity();current.setOwnerId(22L);current.setState("SUCCEEDED");current.setResultJson(write(result));when(actions.lockTurn(id)).thenReturn(current);
        assertEquals(result,new AssistantActionService(turns,actions,workspace).decide(id,true,22L));verifyNoInteractions(workspace);verify(turns,times(1)).selectById(id);
    }
    @Test public void explicitSelectedRenameNeverBecomesAReadDetailsRequest(){
        OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);when(provider.available()).thenReturn(true);
        when(provider.complete(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn("{\"tool\":\"survey_details\",\"arguments\":{\"formKey\":\"owned\"}}");
        Map<String,Object> p=new AssistantPlanner(provider).automatic("把这份问卷的标题改为“新的草稿名”","owned",null,Collections.emptyList());
        assertEquals("manage_survey",p.get("tool"));assertEquals("RENAME",((Map<?,?>)p.get("arguments")).get("action"));verifyNoInteractions(provider);
    }
}
