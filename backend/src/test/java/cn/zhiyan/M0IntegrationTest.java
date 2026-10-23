package cn.zhiyan;

import cn.zhiyan.entity.SystemCheck;
import cn.zhiyan.mapper.SystemCheckMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** No H2, Testcontainers substitution, mocked Mapper, or skipped database tests. */
@SpringBootTest(properties = {"app.admin.username=m0-test", "app.admin.password=Only-For-Automated-Test-2026"})
@AutoConfigureMockMvc
@Transactional
class M0IntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired SystemCheckMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String name = System.getenv().getOrDefault("DB_TEST_NAME", "zhiyan_ai_test");
        if (!name.matches("[a-zA-Z][a-zA-Z0-9_]*_test")) throw new IllegalArgumentException("DB_TEST_NAME must end with _test");
        String host = System.getenv().getOrDefault("DB_HOST", "127.0.0.1");
        String port = System.getenv().getOrDefault("DB_PORT", "3306");
        registry.add("spring.datasource.url", () -> "jdbc:mysql://" + host + ":" + port + "/" + name
                + "?characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&sslMode=DISABLED&connectTimeout=3000&socketTimeout=5000");
    }
    private MockHttpSession login() throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
                .param("username", "m0-test").param("password", "Only-For-Automated-Test-2026"))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    @Test void realMySql8AndMapperInsertRead() {
        assertThat(jdbc.queryForObject("SELECT VERSION()", String.class)).startsWith("8.");
        var row = new SystemCheck(); row.setMessage("真实 Mapper 中文读写");
        assertThat(mapper.insert(row)).isEqualTo(1);
        var loaded = mapper.selectById(row.getId());
        assertThat(loaded.getMessage()).isEqualTo(row.getMessage());
        assertThat(loaded.getCreatedAt()).isNotNull();
    }
    @Test void publicHealthAndCsrf() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
    }
    @Test void anonymousCannotReadOrWriteDiagnostics() throws Exception {
        mvc.perform(get("/api/system-checks")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/system-checks").with(csrf()).contentType("application/json").content("{\"message\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }
    @Test void actualLoginMeAndLogout() throws Exception {
        var session = login();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("m0-test"));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void invalidCredentialsRejected() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "m0-test").param("password", "incorrect"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }
    @Test void csrfRequiredEvenForAuthenticatedWrites() throws Exception {
        mvc.perform(post("/api/system-checks").session(login()).contentType("application/json").content("{\"message\":\"test\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").param("username", "m0-test").param("password", "Only-For-Automated-Test-2026"))
                .andExpect(status().isForbidden());
    }
    @Test void invalidInputReturnsSafe400() throws Exception {
        var session = login();
        for (String body : new String[]{"{\"message\":\"   \"}", "{\"message\":\"" + "x".repeat(201) + "\"}", "{bad-json"}) {
            mvc.perform(post("/api/system-checks").session(session).with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
    }
    @Test void httpWriteReadAndSummaryUseRealDatabase() throws Exception {
        var session = login();
        long before = mapper.selectCount(null);
        mvc.perform(post("/api/system-checks").session(session).with(csrf()).contentType("application/json")
                .content("{\"message\":\"HTTP 到 MySQL\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").isNumber()).andExpect(jsonPath("$.createdAt").isString());
        mvc.perform(get("/api/system-checks").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value("HTTP 到 MySQL"));
        mvc.perform(get("/api/system-checks/summary").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(before + 1));
    }
    @Test void sqlLikeInputIsStoredLiterallyNotExecuted() throws Exception {
        String input = "'; DROP TABLE system_checks; -- <script>alert(1)</script>";
        var row = new SystemCheck(); row.setMessage(input); mapper.insert(row);
        assertThat(mapper.selectById(row.getId()).getMessage()).isEqualTo(input);
        assertThat(mapper.selectCount(Wrappers.<SystemCheck>lambdaQuery().eq(SystemCheck::getMessage, input))).isEqualTo(1);
    }
}
