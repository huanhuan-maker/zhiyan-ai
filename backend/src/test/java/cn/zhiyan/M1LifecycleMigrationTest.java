package cn.zhiyan;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.assertj.core.api.Assertions.assertThat;

/** Execute actual migration SQL on connection-local shadow tables; never alter application rows. */
@SpringBootTest(properties={"app.admin.username=m0-test","app.admin.password=Only-For-Automated-Test-2026"})
class M1LifecycleMigrationTest {
    @Autowired JdbcTemplate jdbc;
    @DynamicPropertySource static void db(DynamicPropertyRegistry registry) { M0IntegrationTest.database(registry); }
    @Test void v4AndCorrectiveMigrationPreserveHistoricalClosureAndNewPublications() {
        jdbc.execute((ConnectionCallback<Void>) c -> {
            try(var sql=c.createStatement()) {
                sql.execute("CREATE TEMPORARY TABLE surveys(id BIGINT PRIMARY KEY,status VARCHAR(16))");
                sql.execute("CREATE TEMPORARY TABLE survey_versions(id BIGINT PRIMARY KEY,survey_id BIGINT,token_hash CHAR(64),published_at DATETIME(6))");
                sql.execute("CREATE TEMPORARY TABLE audit_events(survey_id BIGINT,action VARCHAR(40),created_at DATETIME(6))");
                sql.execute("INSERT INTO surveys VALUES(1,'CLOSED'),(2,'OPEN'),(3,'OPEN')");
                sql.execute("INSERT INTO survey_versions VALUES(11,1,'hash11','2026-01-01'),(21,2,'hash21','2026-01-01'),(22,2,'hash22','2026-01-03'),(31,3,'hash31','2026-01-01')");
                sql.execute("INSERT INTO audit_events VALUES(1,'CLOSE','2026-01-02'),(2,'CLOSE','2026-01-02')");
                migrate(c,"V4__version_lifecycle.sql");
                assertThat(state(c,11)).isEqualTo("CLOSED");
                assertThat(state(c,21)).as("V4 alone cannot reconstruct a closed-then-republished survey").isEqualTo("OPEN");
                migrate(c,"V5__backfill_historical_version_closures.sql");
                assertThat(state(c,11)).isEqualTo("CLOSED");
                assertThat(state(c,21)).isEqualTo("CLOSED");
                assertThat(state(c,22)).isEqualTo("OPEN");
                assertThat(state(c,31)).isEqualTo("OPEN");
                migrate(c,"V5__backfill_historical_version_closures.sql");
                assertThat(state(c,21)).isEqualTo("CLOSED");
                try(var rs=sql.executeQuery("SELECT COUNT(*),COUNT(token_hash) FROM survey_versions")) {
                    rs.next(); assertThat(rs.getInt(1)).isEqualTo(4); assertThat(rs.getInt(2)).isEqualTo(4);
                }
            } finally {
                try(var cleanup=c.createStatement()) {
                    cleanup.execute("DROP TEMPORARY TABLE IF EXISTS audit_events,survey_versions,surveys");
                }
            }
            return null;
        });
    }
    static void migrate(Connection c,String file) {
        ScriptUtils.executeSqlScript(c,new org.springframework.core.io.support.EncodedResource(
                new ClassPathResource("db/migration/"+file),StandardCharsets.UTF_8));
    }
    static String state(Connection c,long id) throws java.sql.SQLException {
        try(var s=c.prepareStatement("SELECT status FROM survey_versions WHERE id=?")) {
            s.setLong(1,id); try(var rs=s.executeQuery()) { rs.next(); return rs.getString(1); }
        }
    }
}
