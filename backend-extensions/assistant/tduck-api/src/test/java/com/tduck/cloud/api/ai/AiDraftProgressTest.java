package com.tduck.cloud.api.ai;
import com.tduck.cloud.common.exception.BaseException;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.assistant.AssistantRateLimit;
import com.tduck.cloud.api.web.controller.AiDraftController;
import org.junit.Test;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.tduck.cloud.form.analysis.AnalysisJson.*;
public class AiDraftProgressTest {
 private void reject(Runnable fn){try{fn.run();fail("Expected rejection");}catch(BaseException expected){}}
 private AiDraftInput input(){AiDraftInput i=new AiDraftInput();i.setGoal("合成验收：大学生学习体验");i.setAudience("大学生");i.setQuestionCount(2);return i;}
 private String valid(){return "{\"kind\":\"draft\",\"title\":\"合成问卷\",\"description\":\"测试\",\"questions\":[{\"type\":\"RADIO\",\"label\":\"你的年级？\",\"options\":[\"大一\",\"大二\"],\"required\":true},{\"type\":\"TEXT\",\"label\":\"有什么建议？\",\"required\":false}],\"dimensions\":[\"学习体验\"]}";}
 @Test public void progressIsOwnerScopedAndContainsOnlyLifecycleEvents(){AiDraftProgress p=new AiDraftProgress();String id=(String)p.start(1L).get("id");reject(()->p.get(id,2L));reject(()->p.claim(id,2L));p.claim(id,1L);p.phase(id,1L,"INPUT_VALIDATED");Map<String,Object> value=p.get(id,1L);assertEquals("INPUT_VALIDATED",value.get("phase"));assertFalse(value.containsKey("goal"));assertFalse(value.containsKey("result"));assertEquals(3,((List<?>)value.get("events")).size());}
 @Test public void requestIdentifiersCannotBeReplayed(){AiDraftProgress p=new AiDraftProgress();String id=(String)p.start(1L).get("id");p.claim(id,1L);reject(()->p.claim(id,1L));}
 @Test public void terminalStateCannotBeReplacedAndReturnedEventsAreCopies(){AiDraftProgress p=new AiDraftProgress();String id=(String)p.start(1L).get("id");p.claim(id,1L);p.phase(id,1L,"SUCCEEDED");p.phase(id,1L,"FAILED");Map<String,Object> value=p.get(id,1L);assertEquals("SUCCEEDED",value.get("phase"));((Map<String,Object>)((List<?>)value.get("events")).get(0)).put("message","tampered");assertFalse(write(p.get(id,1L)).contains("tampered"));}
 @Test public void staleEntriesExpireAndActiveEntriesAreBoundedPerOwner(){AtomicLong time=new AtomicLong(0);AiDraftProgress p=new AiDraftProgress(time::get);String id=(String)p.start(1L).get("id");p.start(1L);p.start(1L);reject(()->p.start(1L));p.start(2L);time.set(16*60*1000L);reject(()->p.get(id,1L));assertNotNull(p.start(1L));}
 @Test public void elapsedValuesComeFromTheClock(){AtomicLong time=new AtomicLong(100);AiDraftProgress p=new AiDraftProgress(time::get);String id=(String)p.start(1L).get("id");time.set(1700);p.claim(id,1L);assertEquals(1600L,p.get(id,1L).get("elapsedMs"));}
 @Test public void modelAndValidationEventsFollowActualExecution(){OpenAiCompatibleProvider real=mock(OpenAiCompatibleProvider.class);when(real.available()).thenReturn(true);List<String> phases=new ArrayList<>();when(real.complete(any(),any())).thenAnswer(call->{assertEquals(Arrays.asList("INPUT_VALIDATED","MODEL_RUNNING"),phases);return valid();});Map<String,Object> result=new AiDraftService(real,new MockAiProvider()).generate(input(),phases::add);assertEquals("draft",result.get("kind"));assertEquals(Arrays.asList("INPUT_VALIDATED","MODEL_RUNNING","VALIDATING","SUCCEEDED"),phases);}
 @Test public void badOutputCannotBeReportedAsCompleted(){OpenAiCompatibleProvider real=mock(OpenAiCompatibleProvider.class);when(real.available()).thenReturn(true);when(real.complete(any(),any())).thenReturn("invalid");List<String> phases=new ArrayList<>();reject(()->new AiDraftService(real,new MockAiProvider()).generate(input(),phases::add));assertEquals(Arrays.asList("INPUT_VALIDATED","MODEL_RUNNING","VALIDATING"),phases);}
 @Test public void invalidInputDoesNotCallTheModelOrEmitValidatedInput(){OpenAiCompatibleProvider real=mock(OpenAiCompatibleProvider.class);AiDraftInput i=input();i.setGoal("");List<String> phases=new ArrayList<>();reject(()->new AiDraftService(real,new MockAiProvider()).generate(i,phases::add));assertTrue(phases.isEmpty());verifyNoInteractions(real);}
 @Test public void progressRecordingFailureDoesNotInterruptGeneration(){AiDraftService service=mock(AiDraftService.class);AiDraftProgress progress=mock(AiDraftProgress.class);AiDraftInput i=input();when(service.generate(eq(i),any())).thenAnswer(call->{Consumer<String> cb=call.getArgument(1);cb.accept("MODEL_RUNNING");return map("kind","draft");});doThrow(new BaseException("tracker unavailable")).when(progress).phase(anyString(),anyLong(),anyString());assertNotNull(new AiDraftController(service,progress,new AssistantRateLimit()).aiDraft(i,1L,"id"));verify(service).generate(eq(i),any());}
}
