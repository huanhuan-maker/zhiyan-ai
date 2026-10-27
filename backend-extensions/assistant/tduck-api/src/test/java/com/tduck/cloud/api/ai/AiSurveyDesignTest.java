package com.tduck.cloud.api.ai;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.assistant.AssistantTools;
import com.tduck.cloud.form.service.UserFormVersionService;
import com.tduck.cloud.form.mapper.UserFormLogicMapper;
import com.tduck.cloud.form.entity.UserFormVersionEntity;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;

public class AiSurveyDesignTest {
    private final OpenAiCompatibleProvider provider=mock(OpenAiCompatibleProvider.class);
    private final AssistantTools tools=mock(AssistantTools.class);
    private final UserFormVersionService versions=mock(UserFormVersionService.class);
    private final UserFormLogicMapper logics=mock(UserFormLogicMapper.class);
    private final AiSurveyDesignService service=new AiSurveyDesignService(provider,tools,versions,logics);
    private Map<String,Object> question(){return map("type","RADIO","label","你使用AI的频率？","required",true,"options",Arrays.asList("每天","从不"));}
    private Map<String,Object> request(){return map("title","测试问卷","goal","了解AI使用情况","audience","大学生","questions",Arrays.asList(question()),"questionNo",1,"instruction","措辞更中立");}
    private Map<String,Object> reviewRequest(){Map<String,Object> r=request();r.remove("questionNo");r.remove("instruction");return r;}
    private void reject(Runnable task){try{task.run();fail("invalid input accepted");}catch(BaseException|IllegalArgumentException expected){}}
    private Map<String,Object> candidate(Map<String,Object> before,Map<String,Object> after){return AiSurveyDesignService.validateCandidate(after,before,Arrays.asList(before),1);}
    private Map<String,Object> issue(String quote){return map("questionNos",Arrays.asList(1),"category","UNCLEAR","severity","warning","problem","时间范围不清晰","suggestion","明确最近一个月","evidence",Arrays.asList(map("questionNo",1,"field","label","quote",quote)));}
    @Test public void candidateKeepsTypeAndRequired(){Map<String,Object> before=question(),after=question();after.put("type","CHECKBOX");reject(()->candidate(before,after));after.put("type","RADIO");after.put("required",false);reject(()->candidate(before,after));}
    @Test public void candidateCannotChangeRatingOrHideFractionalMaximum(){Map<String,Object> before=map("type","RATE","label","满意度","required",true,"rateMax",5);for(Object max:Arrays.asList(7,5.5,"5")){Map<String,Object> after=new LinkedHashMap<>(before);after.put("rateMax",max);reject(()->candidate(before,after));}}
    @Test public void lockedOptionsStayExactlyAsOriginallyConfigured(){Map<String,Object> before=question(),after=question();before.put("optionsLocked",true);after.put("options",Arrays.asList("经常","偶尔"));reject(()->candidate(before,after));assertEquals(before.get("options"),candidate(before,question()).get("options"));}
    @Test public void invalidOptionSetAndUnexpectedFieldsAreRejected(){Map<String,Object> after=question();after.put("options",Arrays.asList("每天","每天"));reject(()->candidate(question(),after));after.put("options",Arrays.asList("每天","从不"));after.put("ownerId",99);reject(()->candidate(question(),after));}
    @Test public void candidateCannotDuplicateAnotherQuestion(){Map<String,Object> other=question();other.put("label","新的题干");Map<String,Object> after=question();after.put("label","新的题干");reject(()->AiSurveyDesignService.validateCandidate(after,question(),Arrays.asList(question(),other),1));}
    @Test public void omittedTextHintIsRetained(){Map<String,Object> before=map("type","TEXTAREA","label","原因","required",false,"placeholder","请举例"),after=map("type","TEXTAREA","label","请描述原因","required",false);assertEquals("请举例",candidate(before,after).get("placeholder"));}
    @Test public void everyIssueMustQuoteActualSource(){assertEquals(1,AiSurveyDesignService.validateIssues(Arrays.asList(issue("AI")),Arrays.asList(question())).size());reject(()->AiSurveyDesignService.validateIssues(Arrays.asList(issue("不存在的引用")),Arrays.asList(question())));}
    @Test public void foreignNumberAndUnsupportedFieldFailEvidenceCheck(){Map<String,Object> i=issue("AI");i.put("questionNos",Arrays.asList(2));reject(()->AiSurveyDesignService.validateIssues(Arrays.asList(i),Arrays.asList(question())));i.put("questionNos",Arrays.asList(1));((Map<String,Object>)((List<?>)i.get("evidence")).get(0)).put("field","answerText");reject(()->AiSurveyDesignService.validateIssues(Arrays.asList(i),Arrays.asList(question())));}
    @Test public void crossQuestionClaimsNeedEvidenceForEveryQuestion(){Map<String,Object> i=issue("AI");i.put("questionNos",Arrays.asList(1,2));reject(()->AiSurveyDesignService.validateIssues(Arrays.asList(i),Arrays.asList(question(),question())));}
    @Test public void localChecksLocateDuplicatesLeadingWordsAndIntersectingRanges(){Map<String,Object> q=question();q.put("label","大家都认为AI很好，你认为呢？");q.put("options",Arrays.asList("1-3次","3-5次"));List<Map<String,Object>> issues=AiSurveyDesignService.localIssues(Arrays.asList(q,new LinkedHashMap<>(q)));assertTrue(issues.stream().anyMatch(i->"LEADING".equals(i.get("category"))));assertTrue(issues.stream().anyMatch(i->"DUPLICATE".equals(i.get("category"))));assertTrue(issues.stream().anyMatch(i->"OPTION_OVERLAP".equals(i.get("category"))));}
    @Test public void noProviderNeverFabricatesACandidate(){Map<String,Object> r=service.optimize(request(),22L);assertEquals("LOCAL",r.get("mode"));assertEquals(false,r.get("available"));assertNull(r.get("after"));verify(provider,never()).complete(any(),any());}
    @Test public void validRealOptimizationHasIdentityAndNoDatabaseWrites(){when(provider.available()).thenReturn(true);when(provider.providerName()).thenReturn("test-provider");when(provider.model()).thenReturn("test-model");when(provider.complete(any(),any())).thenReturn(write(map("question",question(),"reasons",Arrays.asList("措辞中立"),"warnings",Collections.emptyList())));Map<String,Object> r=service.optimize(request(),22L);assertEquals(true,r.get("available"));assertEquals("REAL",r.get("mode"));assertEquals("test-model",r.get("model"));verifyNoInteractions(tools,versions,logics);}
    @Test public void timeoutAndInvalidOutputKeepOriginalIntact(){when(provider.available()).thenReturn(true);Map<String,Object> r=request();String before=write(r);when(provider.complete(any(),any())).thenThrow(new RuntimeException("network"));assertEquals("DEGRADED",service.optimize(r,22L).get("mode"));doReturn("{bad").when(provider).complete(any(),any());assertEquals("DEGRADED",service.optimize(r,22L).get("mode"));assertEquals(before,write(r));}
    @Test public void fabricatedModelEvidenceFallsBackToExplicitLocalReview(){when(provider.available()).thenReturn(true);when(provider.complete(any(),any())).thenReturn(write(map("summary","审阅完成","issues",Arrays.asList(issue("伪造原文")))));Map<String,Object> r=service.review(reviewRequest(),22L);assertEquals("DEGRADED",r.get("mode"));assertFalse(((String)r.get("warning")).isEmpty());}
    @Test public void validSemanticReviewIsMarkedRealAndEvidenceValidated(){when(provider.available()).thenReturn(true);when(provider.complete(any(),any())).thenReturn(write(map("summary","建议明确时间范围","issues",Arrays.asList(issue("AI")))));Map<String,Object> r=service.review(reviewRequest(),22L);assertEquals("REAL",r.get("mode"));assertEquals("AI",((Map<?,?>)((List<?>)r.get("issues")).get(0)).get("origin"));}
    @Test public void ownershipAndPublishedFreezeAreCheckedBeforeAnyModelCall(){Map<String,Object> request=request();request.put("formKey","owned");doThrow(new BaseException("denied")).when(tools).requireOwned("owned",22L);reject(()->service.optimize(request,22L));verifyNoInteractions(provider);reset(tools);when(versions.openVersion("owned")).thenReturn(new UserFormVersionEntity());reject(()->service.optimize(request,22L));verifyNoInteractions(provider);Map<String,Object> review=reviewRequest();review.put("formKey","owned");assertEquals("LOCAL",service.review(review,22L).get("mode"));}
    @Test public void requestCountAndPrivilegeFieldsAreBounded(){Map<String,Object> r=request();r.put("ownerId",99);reject(()->service.optimize(r,22L));r.remove("ownerId");r.put("questions",Collections.nCopies(101,question()));reject(()->service.optimize(r,22L));}
}
