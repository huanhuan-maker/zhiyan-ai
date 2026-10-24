package cn.zhiyan;

import cn.zhiyan.dto.SurveyDtos.*;
import cn.zhiyan.entity.*;
import cn.zhiyan.mapper.*;
import cn.zhiyan.service.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** P1-01/P1-02 regression: version-level collection lifecycle and safe share-token rotation. */
@SpringBootTest(properties={"app.admin.username=m0-test","app.admin.password=Only-For-Automated-Test-2026"})
@AutoConfigureMockMvc @Transactional
class M1PublicationLifecycleTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired AccountService accounts;
    @Autowired SurveyVersionMapper versions; @Autowired AuditEventMapper audits; @Autowired SurveyMapper surveys;
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
    String start(String publicToken) throws Exception {
        return call(post("/api/public/surveys/"+publicToken+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":true,\"aiConsent\":false}"),201).get("sessionToken").asText();
    }
    JsonNode complete(String sessionToken,String answers,int status) throws Exception {
        return call(post("/api/public/sessions/"+sessionToken+"/complete").with(csrf()).contentType("application/json").content("{\"answers\":"+answers+"}"),status);
    }
    JsonNode results(Published p,long versionId) throws Exception {
        return call(get("/api/surveys/"+p.id+"/results").param("versionId",""+versionId).session(p.owner),200);
    }
    JsonNode editDraftAndPublishNext(Published p,String newTitle) throws Exception {
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(draft()); changed.put("title",newTitle);
        call(put("/api/surveys/"+p.id).session(p.owner).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(Map.of("draft",changed,"revision",1))),200);
        return call(post("/api/surveys/"+p.id+"/publish").session(p.owner).with(csrf()).contentType("application/json").content("{\"revision\":2}"),200);
    }

    @Test void closedOldVersionCannotBeReopenedByPublishingNewVersion() throws Exception {
        var p=published();
        complete(start(p.token),"{\"single\":\"yes\",\"scale\":3}",200);
        String inFlight=start(p.token);
        call(post("/api/surveys/"+p.id+"/close").session(p.owner).with(csrf()),200);
        assertThat(call(get("/api/public/surveys/"+p.token),410).get("code").asText()).isEqualTo("SURVEY_CLOSED");
        call(post("/api/public/surveys/"+p.token+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":true}"),410);

        var next=editDraftAndPublishNext(p,"第二版");
        long v2=next.get("versionId").asLong(); String token2=next.get("publicToken").asText();

        assertThat(call(get("/api/public/surveys/"+p.token),410).get("code").asText()).isEqualTo("VERSION_CLOSED");
        call(post("/api/public/surveys/"+p.token+"/sessions").with(csrf()).contentType("application/json").content("{\"consent\":true}"),410);
        call(post("/api/public/sessions/"+inFlight+"/answers").with(csrf()).contentType("application/json").content("{\"questionId\":\"scale\",\"value\":1}"),410);
        assertThat(complete(inFlight,"{\"single\":\"no\",\"scale\":2}",410).get("code").asText()).isEqualTo("VERSION_CLOSED");

        call(get("/api/public/surveys/"+token2),200);
        complete(start(token2),"{\"single\":\"yes\",\"scale\":5}",200);

        assertThat(results(p,p.version).get("completedCount").asInt()).isEqualTo(1);
        assertThat(results(p,v2).get("completedCount").asInt()).isEqualTo(1);
        assertThat(versions.selectById(p.version).getStatus()).isEqualTo("CLOSED");
        assertThat(versions.selectById(v2).getStatus()).isEqualTo("OPEN");
        assertThat(surveys.selectById(p.id).getStatus()).isEqualTo("OPEN");
        assertThat(surveys.selectById(p.id).getLatestVersionId()).isEqualTo(v2);
    }

    @Test void openOldVersionKeepsCollectingUntilExplicitClose() throws Exception {
        var p=published();
        var next=editDraftAndPublishNext(p,"第二版");
        long v2=next.get("versionId").asLong(); String token2=next.get("publicToken").asText();
        assertThat(call(get("/api/public/surveys/"+p.token),200).at("/survey/title").asText()).isEqualTo("食堂满意度");
        complete(start(p.token),"{\"single\":\"yes\",\"scale\":4}",200);

        call(post("/api/surveys/"+p.id+"/close").session(p.owner).with(csrf()),200);
        call(get("/api/public/surveys/"+p.token),410);
        call(get("/api/public/surveys/"+token2),410);
        assertThat(versions.selectList(Wrappers.<SurveyVersion>lambdaQuery().eq(SurveyVersion::getSurveyId,p.id)))
                .allSatisfy(v->assertThat(v.getStatus()).isEqualTo("CLOSED"));
        assertThat(results(p,v2).get("completedCount").asInt()).isZero();
        assertThat(results(p,p.version).get("completedCount").asInt()).isEqualTo(1);
    }

    @Test void rotateTokenIssuesNewLinkInvalidatesOldAndKeepsInFlightSessions() throws Exception {
        var p=published();
        String inFlight=start(p.token);
        var rotated=call(post("/api/surveys/"+p.id+"/versions/"+p.version+"/rotate-token").session(p.owner).with(csrf()),200);
        String token2=rotated.get("publicToken").asText();
        assertThat(token2).isNotEqualTo(p.token).matches("[A-Za-z0-9_-]{43}");
        assertThat(rotated.get("versionId").asLong()).isEqualTo(p.version);
        assertThat(rotated.get("versionStatus").asText()).isEqualTo("OPEN");
        assertThat(rotated.get("surveyStatus").asText()).isEqualTo("OPEN");

        call(get("/api/public/surveys/"+p.token),404);
        call(get("/api/public/surveys/"+token2),200);
        complete(start(token2),"{\"single\":\"yes\",\"scale\":3}",200);
        complete(inFlight,"{\"single\":\"no\",\"scale\":2}",200);
        assertThat(versions.selectById(p.version).getTokenHash()).isEqualTo(SurveyService.hash(token2));

        var events=audits.selectList(Wrappers.<AuditEvent>lambdaQuery().eq(AuditEvent::getSurveyId,p.id));
        assertThat(events).anySatisfy(e->assertThat(e.getAction()).isEqualTo("ROTATE_TOKEN"));
        for(var e:events) assertThat(e.getAction()).doesNotContain(p.token).doesNotContain(token2);
        assertThat(results(p,p.version).get("completedCount").asInt()).isEqualTo(2);
    }

    @Test void rotateTokenRequiresOwnerSessionCsrfAndMatchingVersion() throws Exception {
        var p=published(); var other=published();
        call(post("/api/surveys/"+p.id+"/versions/"+p.version+"/rotate-token").with(csrf()),401);
        String name="stranger_"+UUID.randomUUID().toString().replace("-",""); accounts.register(name,"Stranger-Test-password-2026");
        call(post("/api/surveys/"+p.id+"/versions/"+p.version+"/rotate-token").session(login(name,"Stranger-Test-password-2026")),403);
        call(post("/api/surveys/"+p.id+"/versions/"+p.version+"/rotate-token").session(p.owner),403);
        call(post("/api/surveys/"+p.id+"/versions/"+other.version+"/rotate-token").session(p.owner).with(csrf()),404);
        call(post("/api/surveys/"+p.id+"/versions/999999/rotate-token").session(p.owner).with(csrf()),404);
        call(get("/api/public/surveys/"+p.token),200);
    }

    @Test void duplicatePublishExposesExistingVersionForLinkRecovery() throws Exception {
        var p=published();
        var retry=call(post("/api/surveys/"+p.id+"/publish").session(p.owner).with(csrf()).contentType("application/json").content("{\"revision\":1}"),409);
        assertThat(retry.get("code").asText()).isEqualTo("ALREADY_PUBLISHED");
        assertThat(retry.get("versionId").asLong()).isEqualTo(p.version);
        assertThat(retry.get("versionNumber").asInt()).isEqualTo(1);
        assertThat(versions.selectCount(Wrappers.<SurveyVersion>lambdaQuery().eq(SurveyVersion::getSurveyId,p.id))).isEqualTo(1);

        var rotated=call(post("/api/surveys/"+p.id+"/versions/"+retry.get("versionId").asLong()+"/rotate-token").session(p.owner).with(csrf()),200);
        call(get("/api/public/surveys/"+p.token),404);
        call(get("/api/public/surveys/"+rotated.get("publicToken").asText()),200);
    }
}
