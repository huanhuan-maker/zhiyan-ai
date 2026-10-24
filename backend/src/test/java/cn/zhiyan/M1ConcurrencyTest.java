package cn.zhiyan;

import cn.zhiyan.dto.SurveyDtos.Complete;
import cn.zhiyan.dto.SurveyDtos.Consent;
import cn.zhiyan.dto.SurveyDtos.Draft;
import cn.zhiyan.service.AccountService;
import cn.zhiyan.service.BusinessException;
import cn.zhiyan.service.ResponseService;
import cn.zhiyan.service.ResultsService;
import cn.zhiyan.service.SurveyService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Real MySQL transactions: fixture and both worker commits are visible outside the workers. */
@SpringBootTest(properties = {
        "app.admin.username=m0-test",
        "app.admin.password=Only-For-Automated-Test-2026"
})
@Timeout(45)
class M1ConcurrencyTest {
    @Autowired AccountService accounts;
    @Autowired SurveyService surveys;
    @Autowired ResponseService responses;
    @Autowired ResultsService results;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;

    private final List<Long> fixtureOwnerIds = new ArrayList<>();

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        M0IntegrationTest.database(registry);
    }

    private TransactionTemplate transaction() {
        var tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        tx.setTimeout(20);
        return tx;
    }

    private record Fixture(String owner, long surveyId, long versionId,
                           String sessionToken, long sessionId) { }

    private Fixture fixture() throws Exception {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(jdbc.queryForObject("SELECT VERSION()", String.class)).startsWith("8.");
        Draft draft = json.readValue("""
                {"title":"并发回归专用合成问卷","description":"只使用本测试创建的数据",
                 "privacyNotice":"合成数据；不调用AI。",
                 "perQuestionFollowupLimit":1,"totalFollowupLimit":3,"questions":[
                   {"id":"single","type":"SINGLE","text":"满意度","required":true,"allowFollowup":false,
                    "options":[{"id":"yes","label":"满意"},{"id":"no","label":"不满意"}]},
                   {"id":"multi","type":"MULTIPLE","text":"因素","required":false,"allowFollowup":false,
                    "options":[{"id":"price","label":"价格"},{"id":"taste","label":"口味"}]},
                   {"id":"scale","type":"SCALE","text":"评分","required":true,"allowFollowup":false,
                    "options":[],"min":1,"max":5},
                   {"id":"open","type":"OPEN","text":"建议","required":false,"allowFollowup":true,"options":[]}]}
                """, Draft.class);
        return transaction().execute(status -> {
            String owner = "concurrent_" + UUID.randomUUID().toString().replace("-", "");
            accounts.register(owner, "Concurrency-Synthetic-Password-2026");
            fixtureOwnerIds.add(accounts.userId(owner));
            long surveyId = ((Number) surveys.create(draft, owner).get("id")).longValue();
            Map<String, Object> published = surveys.publish(surveyId, 1, owner);
            long versionId = ((Number) published.get("versionId")).longValue();
            JsonNode started = json.valueToTree(responses.start(
                    (String) published.get("publicToken"), new Consent(true, false)));
            String sessionToken = started.path("sessionToken").asText();
            Long sessionId = jdbc.queryForObject(
                    "SELECT id FROM response_sessions WHERE token_hash = ?", Long.class,
                    SurveyService.hash(sessionToken));
            return new Fixture(owner, surveyId, versionId, sessionToken, sessionId);
        });
    }

    private Complete completeInput() throws Exception {
        JsonNode input = json.readTree("""
                {"single":"yes","multi":["price","taste"],"scale":4,"open":"合成并发答案"}
                """);
        return new Complete(Map.of("single", input.get("single"), "multi", input.get("multi"),
                "scale", input.get("scale"), "open", input.get("open")));
    }

    private static void await(CountDownLatch latch) {
        try {
            assertThat(latch.await(10, TimeUnit.SECONDS)).as("bounded concurrency coordination").isTrue();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Worker interrupted", ex);
        }
    }

    private static void stop(ExecutorService executor) throws InterruptedException {
        executor.shutdownNow();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).as("workers terminated before cleanup").isTrue();
    }

    @Test
    void concurrentCompletionOfSameTokenCommitsOneResponseAndOneAnswerPerQuestion() throws Exception {
        Fixture fixture = fixture();
        Complete input = completeInput();
        var ready = new CountDownLatch(2);
        var submitTogether = new CountDownLatch(1);
        Set<Long> databaseConnections = ConcurrentHashMap.newKeySet();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        List<Future<Object>> futures = new ArrayList<>();
        try {
            for (int worker = 0; worker < 2; worker++) {
                futures.add(executor.submit(() -> transaction().execute(status -> {
                    databaseConnections.add(jdbc.queryForObject("SELECT CONNECTION_ID()", Long.class));
                    ready.countDown();
                    await(submitTogether);
                    return responses.complete(fixture.sessionToken(), input);
                })));
            }
            await(ready);
            submitTogether.countDown();
            for (Future<Object> future : futures) {
                assertThat(json.valueToTree(future.get(15, TimeUnit.SECONDS)).path("status").asText())
                        .isEqualTo("SUBMITTED");
            }
            assertThat(databaseConnections).as("two independent real database transactions").hasSize(2);
        } finally {
            submitTogether.countDown();
            stop(executor);
        }

        // These reads happen after both worker transactions committed, with no test-wide rollback.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM response_sessions WHERE version_id = ? AND status = 'SUBMITTED'",
                Long.class, fixture.versionId())).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM answers WHERE session_id = ?",
                Long.class, fixture.sessionId())).isEqualTo(4L);
        assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT question_id) FROM answers WHERE session_id = ?",
                Long.class, fixture.sessionId())).isEqualTo(4L);
        assertThat(jdbc.queryForList("SELECT question_id FROM answers WHERE session_id = ? ORDER BY question_id",
                String.class, fixture.sessionId())).containsExactly("multi", "open", "scale", "single");
        JsonNode actual = json.valueToTree(results.results(fixture.surveyId(), fixture.versionId(), fixture.owner()));
        assertThat(actual.path("completedCount").asInt()).isEqualTo(1);
        assertThat(actual.at("/questions/0/options/0/numerator").asInt()).isEqualTo(1);
        assertThat(actual.at("/questions/0/denominator").asInt()).isEqualTo(1);
        assertThat(actual.at("/questions/2/average").asDouble()).isEqualTo(4.0);
    }

    @Test
    void closeCommittedAfterSubmissionSnapshotMustStillPreventNewSubmission() throws Exception {
        Fixture fixture = fixture();
        Complete input = completeInput();
        var snapshotEstablished = new CountDownLatch(1);
        var closeCommitted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<BusinessException> outcome = executor.submit(() -> {
                try {
                    transaction().executeWithoutResult(status -> {
                        // The public session lookup in ResponseService is also a consistent read.
                        // Reproduce its RR snapshot before the competing close transaction commits.
                        assertThat(jdbc.queryForObject(
                                "SELECT status FROM response_sessions WHERE id = ?", String.class,
                                fixture.sessionId())).isEqualTo("IN_PROGRESS");
                        snapshotEstablished.countDown();
                        await(closeCommitted);
                        responses.complete(fixture.sessionToken(), input);
                    });
                    return null;
                } catch (BusinessException ex) {
                    return ex;
                }
            });
            await(snapshotEstablished);
            transaction().executeWithoutResult(status -> surveys.close(fixture.surveyId(), fixture.owner()));
            assertThat(jdbc.queryForObject("SELECT status FROM surveys WHERE id = ?", String.class,
                    fixture.surveyId())).isEqualTo("CLOSED");
            closeCommitted.countDown();
            BusinessException failure = outcome.get(15, TimeUnit.SECONDS);
            assertThat(failure).as("a locking read must reject CLOSED even with an older RR snapshot").isNotNull();
            assertThat(failure.getStatus()).isEqualTo(410);
            assertThat(failure.getCode()).isEqualTo("SURVEY_CLOSED");
            assertThat(jdbc.queryForObject("SELECT status FROM response_sessions WHERE id = ?", String.class,
                    fixture.sessionId())).isEqualTo("IN_PROGRESS");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM answers WHERE session_id = ?", Long.class,
                    fixture.sessionId())).isZero();
            assertThat(json.valueToTree(results.results(fixture.surveyId(), fixture.versionId(), fixture.owner()))
                    .path("completedCount").asInt()).isZero();
        } finally {
            closeCommitted.countDown();
            stop(executor);
        }
    }

    @AfterEach
    void removeOnlyThisTestsCommittedFixturesInForeignKeyOrder() {
        for (Long ownerId : fixtureOwnerIds) {
            transaction().executeWithoutResult(status -> {
                jdbc.update("DELETE a FROM answers a JOIN response_sessions r ON a.session_id = r.id "
                        + "JOIN surveys s ON r.survey_id = s.id WHERE s.owner_id = ?", ownerId);
                jdbc.update("DELETE r FROM response_sessions r JOIN surveys s ON r.survey_id = s.id WHERE s.owner_id = ?", ownerId);
                jdbc.update("DELETE e FROM audit_events e JOIN surveys s ON e.survey_id = s.id WHERE s.owner_id = ?", ownerId);
                jdbc.update("UPDATE surveys SET latest_version_id = NULL WHERE owner_id = ?", ownerId);
                jdbc.update("DELETE v FROM survey_versions v JOIN surveys s ON v.survey_id = s.id WHERE s.owner_id = ?", ownerId);
                jdbc.update("DELETE FROM surveys WHERE owner_id = ?", ownerId);
                jdbc.update("DELETE FROM users WHERE id = ?", ownerId);
            });
        }
        fixtureOwnerIds.clear();
    }
}
