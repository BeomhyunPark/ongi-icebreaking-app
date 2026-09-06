package app.ongi.sharing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class GureumiIntegrationTest {

    private static final String CLIENT_HEADER = "X-OnGi-Client";
    private static final String RESUME_HEADER = "X-Gureumi-Resume-Token";
    private static final String ADMIN_HEADER = "X-OnGi-Admin-Key";
    private static final String ADMIN_KEY = "test-admin-key";
    private static final UUID V01_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final UUID V02_ID = UUID.fromString("30000000-0000-0000-0000-000000000002");

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanAttemptsAndTemporaryVersions() {
        jdbcTemplate.update("DELETE FROM gureumi_result_feedback");
        jdbcTemplate.update("DELETE FROM gureumi_answer");
        jdbcTemplate.update("DELETE FROM gureumi_attempt");
        jdbcTemplate.update("DELETE FROM gureumi_question WHERE version_id = ?", V02_ID);
        jdbcTemplate.update("DELETE FROM gureumi_test_version WHERE id = ?", V02_ID);
        jdbcTemplate.update("UPDATE gureumi_test_version SET status = 'ACTIVE' WHERE id = ?", V01_ID);
    }

    @Test
    void questionApiReturnsOnlyPublicCopyAndStoresOnlyATokenHash() throws Exception {
        CreatedAttempt created = createAttempt(null);

        MvcResult questions = mockMvc.perform(get("/api/gureumi/attempts/{id}/questions", created.attemptId())
                .header(RESUME_HEADER, created.resumeToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version", is("GUREUMI_BETA_V01")))
            .andExpect(jsonPath("$.questions", hasSize(27)))
            .andExpect(jsonPath("$.questions[0].order", is(1)))
            .andExpect(jsonPath("$.questions[0].prompt", is("모처럼 시간이 비었다면")))
            .andExpect(jsonPath("$.questions[0].optionA", is("평소 안 해본 걸 찾아보고 싶다.")))
            .andExpect(jsonPath("$.questions[0].optionB", is("원래 좋아하던 걸 하며 보내고 싶다.")))
            .andReturn();

        String json = questions.getResponse().getContentAsString();
        assertThat(json)
            .doesNotContain("axis", "highSide", "high_side", "score", "cutoff", "resultType");

        String storedHash = jdbcTemplate.queryForObject(
            "SELECT resume_token_hash FROM gureumi_attempt WHERE id = ?",
            String.class,
            created.attemptId()
        );
        assertThat(storedHash).hasSize(64).isNotEqualTo(created.resumeToken());
        assertThat(columns("gureumi_attempt")).doesNotContain("resume_token", "ip", "user_agent", "email", "name");
    }

    @Test
    void rejectsIncompleteInvalidForeignAndCompletedMutations() throws Exception {
        CreatedAttempt first = createAttempt(null);
        CreatedAttempt second = createAttempt(null);
        UUID questionId = questionIds(first).getFirst();

        mockMvc.perform(get("/api/gureumi/attempts/{id}/result", first.attemptId())
                .header(RESUME_HEADER, first.resumeToken()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("GUREUMI_RESULT_NOT_READY")));

        complete(first)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("GUREUMI_ANSWERS_INCOMPLETE")));

        saveAnswer(first, questionId, "not-a-choice", 100)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_REQUEST")));
        saveAnswer(first, questionId, "A_VERY", 3_600_001)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_REQUEST")));
        saveAnswer(first, UUID.randomUUID(), "A_VERY", 100)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_GUREUMI_QUESTION")));

        saveAnswer(first, questionId, "A_VERY", 120).andExpect(status().isOk());
        saveAnswer(first, questionId, "B_LITTLE", 240).andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject(
            "SELECT count(*) FROM gureumi_answer WHERE attempt_id = ? AND question_id = ?",
            Integer.class,
            first.attemptId(),
            questionId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "SELECT choice FROM gureumi_answer WHERE attempt_id = ? AND question_id = ?",
            String.class,
            first.attemptId(),
            questionId
        )).isEqualTo("B_LITTLE");

        mockMvc.perform(put("/api/gureumi/attempts/{id}/answers", first.attemptId())
                .header(CLIENT_HEADER, "web")
                .header(RESUME_HEADER, second.resumeToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(answerBody(questionId, "A_VERY", 100)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code", is("GUREUMI_RESUME_REQUIRED")));

        for (UUID id : questionIds(first)) {
            saveAnswer(first, id, "A_VERY", 100).andExpect(status().isOk());
        }
        complete(first).andExpect(status().isOk());
        saveAnswer(first, questionId, "B_VERY", 100)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("ATTEMPT_ALREADY_COMPLETED")));
    }

    @Test
    void resumesEditsCompletesFeedbacksAndStartsARetest() throws Exception {
        CreatedAttempt created = createAttempt(null);
        List<UUID> questionIds = questionIds(created);
        for (int index = 0; index < 5; index++) {
            saveAnswer(created, questionIds.get(index), "A_VERY", 100 + index).andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/gureumi/attempts/current")
                .header(RESUME_HEADER, created.resumeToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.attemptId", is(created.attemptId().toString())))
            .andExpect(jsonPath("$.answeredCount", is(5)))
            .andExpect(jsonPath("$.nextOrder", is(6)))
            .andExpect(jsonPath("$.answers", hasSize(5)));

        saveAnswer(created, questionIds.get(2), "B_VERY", 444).andExpect(status().isOk());
        for (int index = 5; index < questionIds.size(); index++) {
            saveAnswer(created, questionIds.get(index), "A_VERY", 100 + index).andExpect(status().isOk());
        }

        complete(created)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completed", is(true)));
        MvcResult firstCompletion = complete(created)
            .andExpect(status().isOk())
            .andReturn();

        String resultType = json(firstCompletion).path("resultType").asText();
        mockMvc.perform(get("/api/gureumi/attempts/{id}/result", created.attemptId())
                .header(RESUME_HEADER, created.resumeToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resultType", is(resultType)))
            .andExpect(jsonPath("$.axes", hasSize(3)))
            .andExpect(jsonPath("$.feedbackRating").doesNotExist());

        saveFeedback(created, 4)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rating", is(4)));
        saveFeedback(created, 3)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rating", is(3)));

        mockMvc.perform(put("/api/gureumi/attempts/{id}/feedback", created.attemptId())
                .header(CLIENT_HEADER, "web")
                .header(RESUME_HEADER, created.resumeToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "rating", 4,
                    "confusingQuestionOrders", List.of(5, 17),
                    "selfSelectedResultType", "POGEUN"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.confusingQuestionOrders", hasSize(2)))
            .andExpect(jsonPath("$.selfSelectedResultType", is("POGEUN")));

        mockMvc.perform(put("/api/gureumi/attempts/{id}/feedback/follow-up", created.attemptId())
                .header(CLIENT_HEADER, "web")
                .header(RESUME_HEADER, created.resumeToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "flowRating", 4,
                    "questionUiRating", 5,
                    "resultHelpfulnessRating", 4,
                    "helpfulSections", List.of("강점", "균형을 위한 조언"),
                    "resultIssues", List.of("특별히 없었다"),
                    "shareIntent", "아마 할 것 같다",
                    "errorAreas", List.of("없었음"),
                    "environment", "Android Chrome",
                    "comment", "잘 맞았어요."
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.submitted", is(true)));

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM gureumi_result_feedback", Integer.class))
            .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "SELECT confusing_question_orders FROM gureumi_result_feedback WHERE attempt_id = ?",
            String.class,
            created.attemptId()
        )).isEqualTo("5|17");
        assertThat(jdbcTemplate.queryForObject(
            "SELECT free_comment FROM gureumi_result_feedback WHERE attempt_id = ?",
            String.class,
            created.attemptId()
        )).isEqualTo("잘 맞았어요.");

        CreatedAttempt retest = createAttempt(created.resumeToken());
        assertThat(retest.attemptId()).isNotEqualTo(created.attemptId());
        assertThat(retest.resumeToken()).isNotEqualTo(created.resumeToken());
        assertThat(retest.attemptNo()).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
            "SELECT is_first_attempt FROM gureumi_attempt WHERE id = ?",
            Boolean.class,
            retest.attemptId()
        )).isFalse();
    }

    @Test
    void pinsAnAttemptToItsStartingVersion() throws Exception {
        CreatedAttempt created = createAttempt(null);
        List<UUID> v01Questions = questionIds(created);

        jdbcTemplate.update("UPDATE gureumi_test_version SET status = 'ARCHIVED' WHERE id = ?", V01_ID);
        jdbcTemplate.update(
            "INSERT INTO gureumi_test_version (id, code, status, created_at) VALUES (?, 'GUREUMI_BETA_V02', 'ACTIVE', CURRENT_TIMESTAMP)",
            V02_ID
        );
        UUID foreignQuestion = UUID.fromString("32000000-0000-0000-0000-000000000001");
        jdbcTemplate.update("""
            INSERT INTO gureumi_question (
                id, version_id, code, order_no, prompt, option_a, option_b, axis, high_side, active, created_at
            ) VALUES (?, ?, 'N01', 1, '다른 버전 문항', 'A', 'B', 'NOVELTY', 'A', TRUE, CURRENT_TIMESTAMP)
            """, foreignQuestion, V02_ID);

        mockMvc.perform(get("/api/gureumi/attempts/{id}/questions", created.attemptId())
                .header(RESUME_HEADER, created.resumeToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version", is("GUREUMI_BETA_V01")))
            .andExpect(jsonPath("$.questions", hasSize(27)));

        saveAnswer(created, foreignQuestion, "A_VERY", 100)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_GUREUMI_QUESTION")));
        saveAnswer(created, v01Questions.getFirst(), "A_VERY", 100).andExpect(status().isOk());
    }

    @Test
    void aggregatesTheInternalBetaStatisticsWithoutExposingAttemptData() throws Exception {
        CreatedAttempt completed = createAttempt(null);
        List<UUID> completedQuestions = questionIds(completed);
        for (int index = 0; index < completedQuestions.size(); index++) {
            saveAnswer(completed, completedQuestions.get(index), "A_VERY", (index + 1) * 100)
                .andExpect(status().isOk());
        }
        complete(completed).andExpect(status().isOk());
        saveFeedback(completed, 4).andExpect(status().isOk());

        CreatedAttempt inProgress = createAttempt(null);
        List<UUID> inProgressQuestions = questionIds(inProgress);
        for (int index = 0; index < 9; index++) {
            saveAnswer(inProgress, inProgressQuestions.get(index), "B_VERY", (index + 2) * 100)
                .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/gureumi/internal/statistics"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code", is("ADMIN_ACCESS_DENIED")));

        MvcResult response = mockMvc.perform(get("/api/gureumi/internal/statistics")
                .header(ADMIN_HEADER, ADMIN_KEY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version", is("GUREUMI_BETA_V01")))
            .andExpect(jsonPath("$.completedAnswersOnly", is(true)))
            .andExpect(jsonPath("$.firstAttemptOnly", is(true)))
            .andExpect(jsonPath("$.funnel.started", is(2)))
            .andExpect(jsonPath("$.funnel.q9Reached", is(2)))
            .andExpect(jsonPath("$.funnel.q18Reached", is(1)))
            .andExpect(jsonPath("$.funnel.completed", is(1)))
            .andExpect(jsonPath("$.funnel.feedbackSubmitted", is(1)))
            .andExpect(jsonPath("$.questions", hasSize(27)))
            .andExpect(jsonPath("$.questions[0].responseCount", is(1)))
            .andExpect(jsonPath("$.questions[0].aVeryPercentage", is(100.0)))
            .andExpect(jsonPath("$.questions[0].averageScore", is(4.0)))
            .andExpect(jsonPath("$.questions[0].averageResponseMs", is(100)))
            .andExpect(jsonPath("$.axes", hasSize(3)))
            .andExpect(jsonPath("$.axes[0].completedCount", is(1)))
            .andExpect(jsonPath("$.results", hasSize(8)))
            .andExpect(jsonPath("$.feedback.submittedCount", is(1)))
            .andExpect(jsonPath("$.feedback.averageRating", is(4.0)))
            .andExpect(header().string("Cache-Control", "no-store, max-age=0"))
            .andReturn();

        assertThat(response.getResponse().getContentAsString())
            .doesNotContain("resumeToken", "resume_token", "attemptId", "tokenHash");

        mockMvc.perform(get("/api/gureumi/internal/statistics")
                .header(ADMIN_HEADER, ADMIN_KEY)
                .queryParam("completedAnswersOnly", "false"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.questions[0].responseCount", is(2)))
            .andExpect(jsonPath("$.questions[0].aVeryPercentage", is(50.0)))
            .andExpect(jsonPath("$.questions[0].bVeryPercentage", is(50.0)))
            .andExpect(jsonPath("$.questions[0].averageScore", is(2.5)))
            .andExpect(jsonPath("$.questions[0].averageResponseMs", is(150)));
    }

    private CreatedAttempt createAttempt(String previousToken) throws Exception {
        var request = post("/api/gureumi/attempts").header(CLIENT_HEADER, "web");
        if (previousToken != null) {
            request.header(RESUME_HEADER, previousToken);
        }
        JsonNode result = json(mockMvc.perform(request)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version", is("GUREUMI_BETA_V01")))
            .andReturn());
        return new CreatedAttempt(
            UUID.fromString(result.path("attemptId").asText()),
            result.path("resumeToken").asText(),
            result.path("attemptNo").asInt()
        );
    }

    private List<UUID> questionIds(CreatedAttempt attempt) throws Exception {
        JsonNode result = json(mockMvc.perform(get("/api/gureumi/attempts/{id}/questions", attempt.attemptId())
            .header(RESUME_HEADER, attempt.resumeToken())).andReturn());
        List<UUID> ids = new ArrayList<>();
        result.path("questions").forEach(question -> ids.add(UUID.fromString(question.path("questionId").asText())));
        return ids;
    }

    private org.springframework.test.web.servlet.ResultActions saveAnswer(
        CreatedAttempt attempt,
        UUID questionId,
        String choice,
        int responseMs
    ) throws Exception {
        return mockMvc.perform(put("/api/gureumi/attempts/{id}/answers", attempt.attemptId())
            .header(CLIENT_HEADER, "web")
            .header(RESUME_HEADER, attempt.resumeToken())
            .contentType(MediaType.APPLICATION_JSON)
            .content(answerBody(questionId, choice, responseMs)));
    }

    private org.springframework.test.web.servlet.ResultActions complete(CreatedAttempt attempt) throws Exception {
        return mockMvc.perform(post("/api/gureumi/attempts/{id}/complete", attempt.attemptId())
            .header(CLIENT_HEADER, "web")
            .header(RESUME_HEADER, attempt.resumeToken()));
    }

    private org.springframework.test.web.servlet.ResultActions saveFeedback(CreatedAttempt attempt, int rating) throws Exception {
        return mockMvc.perform(put("/api/gureumi/attempts/{id}/feedback", attempt.attemptId())
            .header(CLIENT_HEADER, "web")
            .header(RESUME_HEADER, attempt.resumeToken())
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(java.util.Map.of("rating", rating))));
    }

    private String answerBody(UUID questionId, String choice, int responseMs) throws Exception {
        return objectMapper.writeValueAsString(java.util.Map.of(
            "questionId", questionId,
            "choice", choice,
            "responseMs", responseMs
        ));
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private List<String> columns(String table) {
        return jdbcTemplate.queryForList(
            "SELECT column_name FROM information_schema.columns WHERE table_name = ?",
            String.class,
            table
        );
    }

    private record CreatedAttempt(UUID attemptId, String resumeToken, int attemptNo) {}
}
