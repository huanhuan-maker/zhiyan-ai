package com.tduck.cloud.api.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.tduck.cloud.form.aiconfig.*;
import com.tduck.cloud.form.ai.*;
import com.tduck.cloud.form.assistant.AssistantPlanner;
import com.tduck.cloud.form.entity.AiSettingsEntity;
import com.tduck.cloud.form.mapper.AiSettingsMapper;
import com.tduck.cloud.common.exception.BaseException;
import com.sun.net.httpserver.HttpServer;
import org.junit.Test;
import org.springframework.mock.env.MockEnvironment;
import java.net.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static com.tduck.cloud.form.aiconfig.AiSettingsService.*;

public class AiSettingsTest {
    private AiSettings config(String protocol) {
        AiSettings s=new AiSettings();s.setEnabled(true);AiSettings.Provider p=new AiSettings.Provider();p.setId(UUID.randomUUID().toString());p.setName("Synthetic");p.setBaseUrl("http://127.0.0.1:1/v1");p.setProtocol(protocol);p.setEncryptedKey("cipher-placeholder");
        AiSettings.Model m=new AiSettings.Model();m.setId(UUID.randomUUID().toString());m.setName("Synthetic model");m.setModelId("synthetic-model");p.getModels().add(m);s.getProviders().add(p);s.setDefaultModelId(m.getId());return s;
    }
    private Selection selection(String protocol){AiSettings s=config(protocol);return new Selection(s.getProviders().get(0),s.getProviders().get(0).getModels().get(0),"synthetic-api-key");}
    private void invalid(AiSettings c){try{validate(c);fail("Invalid configuration accepted");}catch(BaseException expected){}}
    @Test public void customMultipleModelsValidate(){AiSettings s=config("OPENAI_CHAT");AiSettings.Model m=new AiSettings.Model();m.setId(UUID.randomUUID().toString());m.setName("Second profile");m.setModelId("other-custom-model");s.getProviders().get(0).getModels().add(m);validate(s);}
    @Test public void outputCannotConsumeContext(){AiSettings s=config("OPENAI_CHAT");s.getProviders().get(0).getModels().get(0).setMaxOutputTokens(32768);invalid(s);}
    @Test public void unsupportedProtocolRejected(){AiSettings s=config("UNKNOWN");invalid(s);}
    @Test public void duplicateProfileIdRejected(){AiSettings s=config("OPENAI_CHAT");s.getProviders().get(0).getModels().add(s.getProviders().get(0).getModels().get(0));invalid(s);}
    @Test public void invalidDefaultRejected(){AiSettings s=config("OPENAI_CHAT");s.setDefaultModelId(UUID.randomUUID().toString());invalid(s);}
    @Test public void disabledEmptySettingsAllowed(){validate(new AiSettings());}
    @Test public void invalidHistoryRejected(){AiSettings s=config("OPENAI_CHAT");s.getProviders().get(0).getModels().get(0).setHistoryTurns(21);invalid(s);}
    @Test public void embeddedEndpointCredentialsRejected(){AiSettings s=config("OPENAI_CHAT");s.getProviders().get(0).setBaseUrl("https://user:secret@example.test/v1");invalid(s);}
    @Test public void minimalNotMappedToAnthropic(){AiSettings s=config("ANTHROPIC");s.getProviders().get(0).getModels().get(0).setReasoningEffort("minimal");invalid(s);}
    @Test public void safeViewNeverReturnsKeyOrCipher(){AiSettings s=config("OPENAI_CHAT");s.getProviders().get(0).setApiKey("synthetic-plaintext-key");String view=safe(s).toString();assertFalse(view.contains("synthetic-plaintext-key"));assertFalse(view.contains("cipher-placeholder"));assertTrue(view.contains("hasApiKey=true"));}
    @Test public void authenticatedEncryptionUsesFreshNonceAndDetectsTampering()throws Exception {
        Path file=Files.createTempFile("ai-key-", ".key");try{byte[] key=new byte[32];new java.security.SecureRandom().nextBytes(key);Files.write(file,Base64.getEncoder().encode(key));AiKeyCipher c=new AiKeyCipher(file.toString());String a=c.encrypt("synthetic-secret"),b=c.encrypt("synthetic-secret");assertNotEquals(a,b);assertEquals("synthetic-secret",c.decrypt(a));byte[] corrupt=Base64.getDecoder().decode(a);corrupt[corrupt.length-1]^=1;try{c.decrypt(Base64.getEncoder().encodeToString(corrupt));fail();}catch(BaseException expected){assertFalse(expected.getMessage().contains("synthetic-secret"));}}finally{Files.deleteIfExists(file);}
    }
    @Test public void missingEncryptionKeyFailsClosed(){try{new AiKeyCipher("nonexistent-synthetic-key").encrypt("secret");fail();}catch(BaseException expected){}}
    @Test public void chatEffortAndOutputBudgetUseCorrectFields(){Selection s=selection("OPENAI_CHAT");s.model.setReasoningEffort("high");Map<String,Object> b=AiTransport.payload(s,"system","input");assertEquals("high",b.get("reasoning_effort"));assertEquals(8192,b.get("max_completion_tokens"));assertFalse(b.containsKey("temperature"));}
    @Test public void chatLegacyOutputParameterIsExplicit(){Selection s=selection("OPENAI_CHAT");s.provider.setOutputTokenParameter("max_tokens");Map<String,Object> b=AiTransport.payload(s,"system","input");assertEquals(8192,b.get("max_tokens"));assertFalse(b.containsKey("reasoning_effort"));}
    @Test public void responsesUseInstructionsAndNoServerStorage(){Selection s=selection("OPENAI_RESPONSES");s.model.setReasoningEffort("medium");Map<String,Object> b=AiTransport.payload(s,"system","input");assertEquals(false,b.get("store"));assertEquals("system",b.get("instructions"));assertEquals(8192,b.get("max_output_tokens"));assertEquals("medium",((Map)b.get("reasoning")).get("effort"));}
    @Test public void anthropicUsesNativeThinkingAndEffort(){Selection s=selection("ANTHROPIC");s.model.setReasoningEffort("low");Map<String,Object>b=AiTransport.payload(s,"system","input");assertEquals("adaptive",((Map)b.get("thinking")).get("type"));assertEquals("low",((Map)b.get("output_config")).get("effort"));assertFalse(b.containsKey("reasoning_effort"));}
    @Test public void anthropicOffDoesNotSendUnsupportedEffort(){Selection s=selection("ANTHROPIC");s.model.setReasoningEffort("none");Map<String,Object>b=AiTransport.payload(s,"s","i");assertEquals("disabled",((Map)b.get("thinking")).get("type"));assertFalse(b.containsKey("output_config"));}
    @Test public void budgetRejectsWithoutTruncation(){Selection s=selection("OPENAI_CHAT");s.model.setContextWindow(1024);s.model.setMaxOutputTokens(64);try{AiTransport.payload(s,"system","完整证据");fail();}catch(AiProviderException expected){assertTrue(expected.getMessage().contains("未截断"));}}
    @Test public void partialOutputsRejected()throws Exception {for(String[] sample:new String[][]{{"OPENAI_CHAT","{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"partial\"}}]}"},{"OPENAI_RESPONSES","{\"status\":\"incomplete\",\"output\":[]}"},{"ANTHROPIC","{\"stop_reason\":\"max_tokens\",\"content\":[]}"}}){try{AiTransport.parse(sample[0],JSON.readTree(sample[1]));fail();}catch(AiProviderException expected){}}}
    @Test public void responsesIgnoreReasoningAndReadTextOnly()throws Exception {assertEquals("OK",AiTransport.parse("OPENAI_RESPONSES",JSON.readTree("{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\",\"content\":[]},{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"OK\"}]}]}")));}
    @Test public void actualHttpTransportUsesProtocolHeadersAndPaths()throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);AtomicReference<String> path=new AtomicReference<>(),auth=new AtomicReference<>();
        server.createContext("/",e->{path.set(e.getRequestURI().getPath());auth.set(e.getRequestHeaders().getFirst("x-api-key"));while(e.getRequestBody().read()!=-1){}byte[] bytes="{\"stop_reason\":\"end_turn\",\"content\":[{\"type\":\"thinking\",\"thinking\":\"ignore\"},{\"type\":\"text\",\"text\":\"OK\"}]}".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try{Selection s=selection("ANTHROPIC");s.provider.setBaseUrl("http://127.0.0.1:"+server.getAddress().getPort()+"/v1");assertEquals("OK",new AiTransport().complete(s,"system","input"));assertEquals("/v1/messages",path.get());assertEquals("synthetic-api-key",auth.get());}finally{server.stop(0);}
    }
    @Test public void staleRevisionNeverWrites(){AiSettingsMapper mapper=mock(AiSettingsMapper.class);AiSettingsEntity row=new AiSettingsEntity();row.setId(1L);row.setRevision(3);row.setConfigJson("{\"enabled\":false,\"providers\":[]}");when(mapper.selectById(1L)).thenReturn(row);AiSettingsService svc=new AiSettingsService(mapper,mock(AiKeyCipher.class),new MockEnvironment());try{svc.save(new AiSettings(),1L);fail();}catch(BaseException expected){}verify(mapper,never()).update(any(),any());}
    @Test public void defaultSelectionComesFromPersistedProfile()throws Exception {AiSettings cfg=config("OPENAI_RESPONSES");AiSettingsMapper mapper=mock(AiSettingsMapper.class);AiSettingsEntity row=new AiSettingsEntity();row.setRevision(1);row.setConfigJson(JSON.writeValueAsString(cfg));when(mapper.selectById(1L)).thenReturn(row);AiKeyCipher cipher=mock(AiKeyCipher.class);when(cipher.decrypt(any())).thenReturn("synthetic-key");Selection s=new AiSettingsService(mapper,cipher,new MockEnvironment()).selected();assertEquals("synthetic-model",s.model.getModelId());assertEquals("OPENAI_RESPONSES",s.provider.getProtocol());}
    @Test public void plannerHistoryIsBoundedAndContainsQuestionsOnly(){OpenAiCompatibleProvider p=mock(OpenAiCompatibleProvider.class);when(p.available()).thenReturn(true);when(p.historyTurns()).thenReturn(1);when(p.complete(any(),any())).thenReturn("{\"tool\":\"none\",\"arguments\":{}}");new AssistantPlanner(p).plan("current","owned",1,true,true,Arrays.asList("older-question","latest-question"));org.mockito.ArgumentCaptor<String> input=org.mockito.ArgumentCaptor.forClass(String.class);verify(p).complete(any(),input.capture());assertTrue(input.getValue().contains("latest-question"));assertFalse(input.getValue().contains("older-question"));assertFalse(input.getValue().contains("answerText"));}
    @Test public void optionalRequestTracingNeverLogsCredentialsOrBodies()throws Exception {
        ch.qos.logback.classic.Logger logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(com.tduck.cloud.api.web.filter.HttpTraceLogFilter.class);
        ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender=new ch.qos.logback.core.read.ListAppender<>();appender.start();logger.addAppender(appender);
        try {
            org.springframework.mock.web.MockHttpServletRequest request=new org.springframework.mock.web.MockHttpServletRequest("POST","/user/ai-settings");request.addHeader("token","synthetic-sensitive-header");request.setQueryString("apiKey=synthetic-sensitive-query");request.setContent("{\"apiKey\":\"synthetic-sensitive-body\"}".getBytes(StandardCharsets.UTF_8));
            org.springframework.mock.web.MockHttpServletResponse response=new org.springframework.mock.web.MockHttpServletResponse();
            new com.tduck.cloud.api.web.filter.HttpTraceLogFilter().doFilter(request,response,(req,res)->res.getWriter().write("synthetic-sensitive-response"));
            assertEquals(1,appender.list.size());String log=appender.list.get(0).getFormattedMessage();assertTrue(log.contains("/user/ai-settings"));assertFalse(log.contains("synthetic-sensitive"));assertTrue(response.getContentAsString().contains("synthetic-sensitive-response"));
        } finally {logger.detachAppender(appender);appender.stop();}
    }
}
