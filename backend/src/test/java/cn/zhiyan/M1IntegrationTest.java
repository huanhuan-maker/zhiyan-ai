package cn.zhiyan;

import cn.zhiyan.entity.*;
import cn.zhiyan.mapper.*;
import cn.zhiyan.service.*;
import cn.zhiyan.dto.SurveyDtos.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.admin.username=m0-test","app.admin.password=Only-For-Automated-Test-2026"})
@AutoConfigureMockMvc @Transactional
class M1IntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired AccountService accounts;
    @Autowired ResponseSessionMapper sessions; @Autowired AnswerMapper answers; @Autowired SurveyVersionMapper versions;
    @Autowired UserAccountMapper users;
    @DynamicPropertySource static void db(DynamicPropertyRegistry registry) { M0IntegrationTest.database(registry); }
    MockHttpSession login(String name,String password) throws Exception {
        return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).param("username",name).param("password",password))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    MockHttpSession owner() throws Exception { return login("m0-test","Only-For-Automated-Test-2026"); }
    JsonNode call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req,int status) throws Exception {
        var action=mvc.perform(req);
        if(action.andReturn().getResponse().getStatus()!=status && action.andReturn().getResolvedException()!=null) {
            action.andReturn().getResolvedException().printStackTrace();
        }
        var result=action.andExpect(status().is(status)).andReturn();
        String body=result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank()?json.nullNode():json.readTree(body);
    }
    String draft() {
        return """
          {"title":"食堂满意度","description":"合成验收调查","privacyNotice":"仅用于匿名合成测试；M1不调用AI。",
           "perQuestionFollowupLimit":1,"totalFollowupLimit":3,"questions":[
             {"id":"single","type":"SINGLE","text":"满意度","required":true,"allowFollowup":false,"options":[{"id":"yes","label":"满意"},{"id":"no","label":"不满意"}]},
             {"id":"multi","type":"MULTIPLE","text":"关注因素","required":false,"allowFollowup":false,"options":[{"id":"price","label":"价格"},{"id":"taste","label":"口味"}]},
             {"id":"scale","type":"SCALE","text":"评分","required":true,"allowFollowup":false,"options":[],"min":1,"max":5},
             {"id":"open","type":"OPEN","text":"建议","required":false,"allowFollowup":true,"options":[]}]}
          """;
    }
    record Published(long id,long version,String token,MockHttpSession owner) { }
    Published published() throws Exception {
        var owner=owner(); long id=call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(draft()),201).get("id").asLong();
        var v=call(post("/api/surveys/"+id+"/publish").session(owner).with(csrf()).contentType("application/json").content("{\"revision\":1}"),200);
        return new Published(id,v.get("versionId").asLong(),v.get("publicToken").asText(),owner);
    }
    String start(Published p,boolean ai) throws Exception {
        return call(post("/api/public/surveys/"+p.token+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":true,\"aiConsent\":"+ai+"}"),201).get("sessionToken").asText();
    }
    JsonNode complete(String token,String input,int status) throws Exception { return call(post("/api/public/sessions/"+token+"/complete").with(csrf()).contentType("application/json").content("{\"answers\":"+input+"}"),status); }
    JsonNode results(Published p) throws Exception { return call(get("/api/surveys/"+p.id+"/results").param("versionId",""+p.version).session(p.owner),200); }
    @Test void registerHashesPasswordAndRealLoginWorks() throws Exception {
        String name="new_"+UUID.randomUUID().toString().replace("-","");
        call(post("/api/auth/register").with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("username",name,"password","Synthetic-test-password-2026"))),201);
        var row=accounts.find(name); assertThat(row.getPasswordHash()).startsWith("{bcrypt}").doesNotContain("Synthetic-test");
        var session=login(name,"Synthetic-test-password-2026"); call(get("/api/auth/me").session(session),200);
        call(post("/api/auth/register").with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("username",name,"password","Synthetic-test-password-2026"))),409);
        call(post("/api/auth/register").with(csrf()).contentType("application/json").content("{\"username\":\"abc\",\"password\":\"short\"}"),400);
    }
    @Test void draftSaveRefreshAndOptimisticLock() throws Exception {
        var owner=owner(); long id=call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(draft()),201).get("id").asLong();
        var changed=json.readTree(draft()); ((com.fasterxml.jackson.databind.node.ObjectNode)changed).put("title","修改后保留");
        call(put("/api/surveys/"+id).session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("draft",changed,"revision",1))),200);
        var fetched=call(get("/api/surveys/"+id).session(owner),200); assertThat(fetched.at("/draft/title").asText()).isEqualTo("修改后保留");
        call(put("/api/surveys/"+id).session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("draft",changed,"revision",1))),409);
    }
    @Test void publishedVersionIsFrozenAcrossDraftEditAndRepublish() throws Exception {
        var p=published(); String oldSnapshot=versions.selectById(p.version).getSnapshotJson();
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft()); changed.put("title","第二版");
        call(put("/api/surveys/"+p.id).session(p.owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("draft",changed,"revision",1))),200);
        var v=call(post("/api/surveys/"+p.id+"/publish").session(p.owner).with(csrf()).contentType("application/json").content("{\"revision\":2}"),200);
        assertThat(v.get("versionNumber").asInt()).isEqualTo(2);
        var old=call(get("/api/public/surveys/"+p.token),200); assertThat(old.at("/survey/title").asText()).isEqualTo("食堂满意度");
        assertThat(versions.selectById(p.version).getSnapshotJson()).isEqualTo(oldSnapshot);
        assertThat(versions.selectById(p.version).getTokenHash()).doesNotContain(p.token);
        call(post("/api/surveys/"+p.id+"/publish").session(p.owner).with(csrf()).contentType("application/json").content("{\"revision\":2}"),409);
    }
    @Test void secondAccountCannotListReadEditPublishCloseOrReadResults() throws Exception {
        var p=published(); String other="other_"+UUID.randomUUID().toString().replace("-",""); accounts.register(other,"Other-Test-password-2026"); var session=login(other,"Other-Test-password-2026");
        assertThat(call(get("/api/surveys").session(session),200).size()).isZero();
        call(get("/api/surveys/"+p.id).session(session),404);
        call(put("/api/surveys/"+p.id).session(session).with(csrf()).contentType("application/json").content("{\"draft\":"+draft()+",\"revision\":1}"),404);
        call(post("/api/surveys/"+p.id+"/publish").session(session).with(csrf()).contentType("application/json").content("{\"revision\":1}"),404);
        call(post("/api/surveys/"+p.id+"/close").session(session).with(csrf()),404);
        call(get("/api/surveys/"+p.id+"/results").session(session).param("versionId",""+p.version),404);
        call(get("/api/surveys/"+p.id+"/results").param("versionId",""+p.version),401);
    }
    @Test void consentAndCsrfAreRequiredAndAiCanBeRefused() throws Exception {
        var p=published(); call(post("/api/public/surveys/"+p.token+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":false,\"aiConsent\":false}"),400);
        call(post("/api/public/surveys/"+p.token+"/sessions").contentType("application/json").content("{\"consent\":true}"),403);
        var token=start(p,false); var restored=call(get("/api/public/sessions/"+token),200); assertThat(restored.get("aiConsent").asBoolean()).isFalse();
    }
    @Test void saveAnswerRefreshRestoreAndSeparateSessions() throws Exception {
        var p=published(); var token=start(p,false); var other=start(p,false);
        call(post("/api/public/sessions/"+token+"/answers").with(csrf()).contentType("application/json").content("{\"questionId\":\"open\",\"value\":\"六点排队十五分钟\"}"),200);
        assertThat(call(get("/api/public/sessions/"+token),200).at("/answers/open").asText()).isEqualTo("六点排队十五分钟");
        assertThat(call(get("/api/public/sessions/"+other),200).get("answers").size()).isZero();
        call(get("/api/public/sessions/"+"x".repeat(43)),404);
        assertThat(results(p).get("completedCount").asInt()).isZero();
    }
    @Test void twoResponsesStatsDenominatorsAndIdempotentSubmit() throws Exception {
        var p=published(); var a=start(p,false); var b=start(p,true);
        complete(a,"{\"single\":\"yes\",\"multi\":[\"price\",\"taste\"],\"scale\":4,\"open\":\"合成建议\"}",200);
        complete(b,"{\"single\":\"no\",\"multi\":[\"price\"],\"scale\":2}",200);
        complete(a,"{\"single\":\"no\",\"scale\":1}",200);
        var result=results(p); assertThat(result.get("completedCount").asInt()).isEqualTo(2);
        assertThat(result.at("/questions/0/denominator").asInt()).isEqualTo(2);
        assertThat(result.at("/questions/0/options/0/numerator").asInt()).isEqualTo(1);
        assertThat(result.at("/questions/0/options/0/percentage").asDouble()).isEqualTo(50);
        assertThat(result.at("/questions/1/options/0/percentage").asDouble()).isEqualTo(100);
        assertThat(result.at("/questions/1/options/1/percentage").asDouble()).isEqualTo(50);
        assertThat(result.at("/questions/2/average").asDouble()).isEqualTo(3);
        assertThat(result.at("/questions/3/missing").asInt()).isEqualTo(1);
        call(post("/api/public/sessions/"+a+"/answers").with(csrf()).contentType("application/json").content("{\"questionId\":\"scale\",\"value\":1}"),409);
    }
    @Test void optionalMissingIsExcludedFromDenominator() throws Exception {
        var p=published(); complete(start(p,false),"{\"single\":\"yes\",\"scale\":3}",200);
        var result=results(p); assertThat(result.at("/questions/1/denominator").asInt()).isZero();
        assertThat(result.at("/questions/1/missing").asInt()).isEqualTo(1);
    }
    @Test void emptyArrayIsOnlyValidForMultipleChoice() throws Exception {
        var p=published(); var token=start(p,false);
        for(String id:List.of("single","scale","open")) {
            call(post("/api/public/sessions/"+token+"/answers").with(csrf()).contentType("application/json")
                    .content("{\"questionId\":\""+id+"\",\"value\":[]}"),400);
        }
        complete(token,"{\"single\":\"yes\",\"scale\":3,\"open\":[]}",400);
        assertThat(answers.selectCount(null)).isZero();
        assertThat(results(p).get("completedCount").asInt()).isZero();
        complete(token,"{\"single\":\"yes\",\"scale\":3,\"multi\":[],\"open\":null}",200);
        assertThat(results(p).at("/questions/1/denominator").asInt()).isZero();
    }
    @Test void closedSurveyBlocksStartSaveAndSubmit() throws Exception {
        var p=published(); var token=start(p,false); call(post("/api/surveys/"+p.id+"/close").session(p.owner).with(csrf()),200);
        call(get("/api/public/surveys/"+p.token),410);
        call(post("/api/public/surveys/"+p.token+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":true}"),410);
        call(post("/api/public/sessions/"+token+"/answers").with(csrf()).contentType("application/json").content("{\"questionId\":\"scale\",\"value\":3}"),410);
        complete(token,"{\"single\":\"yes\",\"scale\":3}",410);
        assertThat(results(p).get("completedCount").asInt()).isZero();
    }
    @Test void expiredSessionRejected() throws Exception {
        var p=published(); var token=start(p,false); var row=sessions.selectOne(Wrappers.<ResponseSession>lambdaQuery().eq(ResponseSession::getTokenHash,SurveyService.hash(token)));
        row.setExpiresAt(LocalDateTime.now().minusSeconds(1)); sessions.updateById(row);
        call(get("/api/public/sessions/"+token),410); complete(token,"{}",410);
    }
    @Test void invalidAnswersAndMissingRequiredCannotPartiallyCommit() throws Exception {
        var p=published(); var token=start(p,false);
        for(String body:List.of("{}","{\"single\":\"unknown\",\"scale\":3}","{\"single\":\"yes\",\"scale\":9}","{\"single\":\"yes\",\"scale\":2,\"multi\":[\"price\",\"price\"]}","{\"single\":\"yes\",\"scale\":2,\"unknown\":1}")) complete(token,body,400);
        assertThat(answers.selectCount(null)).isZero(); assertThat(results(p).get("completedCount").asInt()).isZero();
    }
    @Test void malformedSurveyCannotPublish() throws Exception {
        var owner=owner(); call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(draft().replace("\"max\":5","\"max\":1")),400);
        call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(draft().replace("\"id\":\"scale\"","\"id\":\"single\"")),400);
    }
    @Test void nullNestedQuestionAndOptionReturn400InsteadOf500() throws Exception {
        var owner=owner();
        var q=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft());
        ((com.fasterxml.jackson.databind.node.ArrayNode)q.get("questions")).set(0,json.nullNode());
        call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(q.toString()),400);
        q=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft());
        ((com.fasterxml.jackson.databind.node.ArrayNode)q.at("/questions/0/options")).set(0,json.nullNode());
        call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(q.toString()),400);
    }
    @Test void stableQuestionIdsKeepCaseAndMalformedPathReturns400() throws Exception {
        var owner=owner();
        String d=draft().replace("\"id\":\"single\"","\"id\":\"a\"").replace("\"id\":\"scale\"","\"id\":\"A\"");
        long id=call(post("/api/surveys").session(owner).with(csrf()).contentType("application/json").content(d),201).get("id").asLong();
        var v=call(post("/api/surveys/"+id+"/publish").session(owner).with(csrf()).contentType("application/json").content("{\"revision\":1}"),200);
        var p=new Published(id,v.get("versionId").asLong(),v.get("publicToken").asText(),owner);
        complete(start(p,false),"{\"a\":\"yes\",\"A\":4}",200);
        assertThat(results(p).get("completedCount").asInt()).isEqualTo(1);
        call(get("/api/surveys/not-a-number").session(owner),400);
        call(get("/api/surveys/"+id+"/results").session(owner),400);
    }
    @Test void resultsCannotMixVersions() throws Exception {
        var p=published(); complete(start(p,false),"{\"single\":\"yes\",\"scale\":3}",200);
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft()); changed.put("title","新版");
        call(put("/api/surveys/"+p.id).session(p.owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("draft",changed,"revision",1))),200);
        var v=call(post("/api/surveys/"+p.id+"/publish").session(p.owner).with(csrf()).contentType("application/json").content("{\"revision\":2}"),200);
        assertThat(results(p).get("completedCount").asInt()).isEqualTo(1);
        assertThat(call(get("/api/surveys/"+p.id+"/results").session(p.owner).param("versionId",v.get("versionId").asText()),200).get("completedCount").asInt()).isZero();
    }
}
