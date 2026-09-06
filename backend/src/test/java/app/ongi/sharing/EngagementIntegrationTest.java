package app.ongi.sharing;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
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
class EngagementIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    ObjectMapper objectMapper;

    @AfterEach
    void cleanEngagement() {
        jdbcTemplate.update("DELETE FROM event_log");
        jdbcTemplate.update("DELETE FROM content_like");
        jdbcTemplate.update("DELETE FROM participation");
        jdbcTemplate.update("DELETE FROM visit");
        jdbcTemplate.update("DELETE FROM visitor");
        jdbcTemplate.update("DELETE FROM share_link");
        jdbcTemplate.update("DELETE FROM content_result WHERE code = 'foreign-result'");
    }

    @Test
    void createsVisitorsAndVisitsIdempotentlyWithoutIpOrDeviceData() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        UUID visitKey = UUID.randomUUID();

        ensureVisitor(visitorKey).andExpect(status().isOk());
        ensureVisitor(visitorKey).andExpect(status().isOk());
        ensureVisit(visitKey, visitorKey, null).andExpect(status().isOk());
        ensureVisit(visitKey, visitorKey, null).andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(count("visitor")).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(count("visit")).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(columns("visitor"))
            .containsExactlyInAnyOrder("id", "visitor_key", "created_at", "last_seen_at")
            .doesNotContain("ip", "user_agent", "name", "email");

        UUID anotherVisitor = UUID.randomUUID();
        ensureVisitor(anotherVisitor).andExpect(status().isOk());
        ensureVisit(visitKey, anotherVisitor, null)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("VISIT_KEY_CONFLICT")));

        mockMvc.perform(put("/api/engagement/visitors/not-a-uuid")
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_REQUEST")));
    }

    @Test
    void startsAndCompletesParticipationIdempotently() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        UUID visitKey = UUID.randomUUID();
        UUID requestKey = UUID.randomUUID();
        ensureVisitorAndVisit(visitorKey, visitKey);

        MvcResult started = startParticipation(visitKey, "heart-trace", requestKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.versionNo", is("v1")))
            .andReturn();
        startParticipation(visitKey, "heart-trace", requestKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.participationId", is(json(started).path("participationId").asInt())));
        org.assertj.core.api.Assertions.assertThat(count("participation")).isEqualTo(1);

        long participationId = json(started).path("participationId").asLong();
        completeParticipation(participationId, visitKey, null)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("RESULT_REQUIRED")));
        completeParticipation(participationId, visitKey, "unknown")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_RESULT")));
        completeParticipation(participationId, visitKey, "bear")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resultCode", is("bear")));
        completeParticipation(participationId, visitKey, "bear")
            .andExpect(status().isOk());
        completeParticipation(participationId, visitKey, "spring")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("PARTICIPATION_ALREADY_COMPLETED")));
    }

    @Test
    void rejectsResultFromAnotherContentVersionInServiceAndDatabase() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        UUID visitKey = UUID.randomUUID();
        ensureVisitorAndVisit(visitorKey, visitKey);
        MvcResult started = startParticipation(visitKey, "heart-trace", UUID.randomUUID()).andReturn();
        long participationId = json(started).path("participationId").asLong();
        jdbcTemplate.update("""
            INSERT INTO content_result (version_id, code, name, sort_order, active, created_at)
            SELECT version.id, 'foreign-result', '다른 버전 결과', 999, TRUE, CURRENT_TIMESTAMP
            FROM content_version version
            JOIN content ON content.id = version.content_id
            WHERE content.code = 'balance-game' AND version.version_no = 'v1'
            """);

        completeParticipation(participationId, visitKey, "foreign-result")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_RESULT")));

        Long foreignResultId = jdbcTemplate.queryForObject(
            "SELECT id FROM content_result WHERE code = 'foreign-result'",
            Long.class
        );
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbcTemplate.update(
            "UPDATE participation SET result_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
            foreignResultId,
            participationId
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void likesAndUnlikesIdempotently() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        ensureVisitor(visitorKey).andExpect(status().isOk());

        like("heart-trace", visitorKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.variantCode", is("default")))
            .andExpect(jsonPath("$.liked", is(true)))
            .andExpect(jsonPath("$.likeCount", is(1)));
        like("heart-trace", visitorKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.likeCount", is(1)));
        unlike("heart-trace", visitorKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.liked", is(false)))
            .andExpect(jsonPath("$.likeCount", is(0)));
        unlike("heart-trace", visitorKey)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.likeCount", is(0)));
    }

    @Test
    void differentVisitorsAddIndependentLikesAndCannotRemoveEachOthersLikes() throws Exception {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        like("anonymous-sharing", first)
            .andExpect(status().isOk()).andExpect(jsonPath("$.likeCount", is(1)));
        mockMvc.perform(get("/api/engagement/contents/anonymous-sharing/like")
                .param("visitorKey", second.toString()).param("variant", "default"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.liked", is(false)))
            .andExpect(jsonPath("$.likeCount", is(1)));
        like("anonymous-sharing", second)
            .andExpect(status().isOk()).andExpect(jsonPath("$.likeCount", is(2)));
        like("anonymous-sharing", second)
            .andExpect(status().isOk()).andExpect(jsonPath("$.likeCount", is(2)));
        unlike("anonymous-sharing", third)
            .andExpect(status().isOk()).andExpect(jsonPath("$.likeCount", is(2)));
        unlike("anonymous-sharing", second)
            .andExpect(status().isOk()).andExpect(jsonPath("$.likeCount", is(1)));
        mockMvc.perform(get("/api/engagement/contents/anonymous-sharing/like")
                .param("visitorKey", first.toString()).param("variant", "default"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.liked", is(true)))
            .andExpect(jsonPath("$.likeCount", is(1)));
    }

    @Test
    void includesLikesFromPreviousDaysAndPreservesVisitorLikeAcrossVisits() throws Exception {
        UUID visitor = UUID.randomUUID();
        like("anonymous-sharing", visitor).andExpect(status().isOk());
        jdbcTemplate.update("UPDATE content_like SET created_at = CURRENT_TIMESTAMP - INTERVAL '30 days'");
        ensureVisit(UUID.randomUUID(), visitor, null).andExpect(status().isOk());
        like("anonymous-sharing", UUID.randomUUID()).andExpect(status().isOk());
        mockMvc.perform(get("/api/engagement/contents/anonymous-sharing/like")
                .param("visitorKey", visitor.toString()).param("variant", "default"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.liked", is(true)))
            .andExpect(jsonPath("$.likeCount", is(2)));
    }

    @Test
    void keepsLikesIndependentForContentVariants() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        ensureVisitor(visitorKey).andExpect(status().isOk());

        like("ideal-world-cup", visitorKey, "meal")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.variantCode", is("meal")))
            .andExpect(jsonPath("$.likeCount", is(1)));
        like("ideal-world-cup", visitorKey, "dessert")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.variantCode", is("dessert")))
            .andExpect(jsonPath("$.likeCount", is(1)));
        mockMvc.perform(get("/api/engagement/contents/ideal-world-cup/like")
                .queryParam("visitorKey", visitorKey.toString())
                .queryParam("variant", "travel"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.liked", is(false)))
            .andExpect(jsonPath("$.likeCount", is(0)));

        unlike("ideal-world-cup", visitorKey, "meal")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.likeCount", is(0)));
        mockMvc.perform(get("/api/engagement/contents/ideal-world-cup/like")
                .queryParam("visitorKey", visitorKey.toString())
                .queryParam("variant", "dessert"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.liked", is(true)))
            .andExpect(jsonPath("$.likeCount", is(1)));

        like("balance-game", visitorKey, "deep").andExpect(status().isOk());
        like("group-picker", visitorKey, "groups").andExpect(status().isOk());
        like("ideal-world-cup", visitorKey, "unknown")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_LIKE_VARIANT")));

        mockMvc.perform(get("/api/engagement/contents/ideal-world-cup/statistics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.likeCount", is(1)))
            .andExpect(jsonPath("$.variantLikes[0].variantCode", is("meal")))
            .andExpect(jsonPath("$.variantLikes[0].likeCount", is(0)))
            .andExpect(jsonPath("$.variantLikes[1].variantCode", is("dessert")))
            .andExpect(jsonPath("$.variantLikes[1].likeCount", is(1)));
    }

    @Test
    void recordsOnlyWhitelistedEventDataAndDeduplicatesEventKey() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        UUID visitKey = UUID.randomUUID();
        UUID eventKey = UUID.randomUUID();
        ensureVisitorAndVisit(visitorKey, visitKey);

        event(eventKey, visitKey, "heart-trace", "SHARE_CLICK", Map.of("target", "copy_link"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.recorded", is(true)));
        event(eventKey, visitKey, "heart-trace", "SHARE_CLICK", Map.of("target", "copy_link"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.recorded", is(false)));
        event(eventKey, visitKey, "heart-trace", "SHARE_CLICK", Map.of("target", "native"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("EVENT_KEY_CONFLICT")));
        org.assertj.core.api.Assertions.assertThat(count("event_log")).isEqualTo(1);

        event(UUID.randomUUID(), visitKey, "heart-trace", "CONTENT_VIEW", Map.of("email", "no@example.com"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("EVENT_DATA_NOT_ALLOWED")));
        event(UUID.randomUUID(), visitKey, "heart-trace", "SHARE_CLICK", Map.of("target", "arbitrary"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_SHARE_TARGET")));
        event(UUID.randomUUID(), visitKey, "heart-trace", "UNKNOWN", Map.of())
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code", is("INVALID_REQUEST")));
    }

    @Test
    void connectsOnlyActiveUnexpiredShareLinksToVisits() throws Exception {
        insertShareLink("retreat26", true, Instant.now().plusSeconds(3600));
        insertShareLink("expired26", true, Instant.now().minusSeconds(60));
        insertShareLink("inactive26", false, null);
        UUID visitorKey = UUID.randomUUID();
        ensureVisitor(visitorKey).andExpect(status().isOk());

        ensureVisit(UUID.randomUUID(), visitorKey, "retreat26")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareCode", is("retreat26")));
        mockMvc.perform(get("/api/engagement/share-links/retreat26"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentCode", is("heart-trace")));
        ensureVisit(UUID.randomUUID(), visitorKey, "expired26")
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("SHARE_LINK_NOT_AVAILABLE")));
        ensureVisit(UUID.randomUUID(), visitorKey, "inactive26")
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("SHARE_LINK_NOT_AVAILABLE")));
    }

    @Test
    void exposesOnlyAggregatePublicContentStatistics() throws Exception {
        UUID visitorKey = UUID.randomUUID();
        UUID visitKey = UUID.randomUUID();
        ensureVisitorAndVisit(visitorKey, visitKey);
        event(UUID.randomUUID(), visitKey, "heart-trace", "CONTENT_VIEW", Map.of()).andExpect(status().isOk());
        event(UUID.randomUUID(), visitKey, "heart-trace", "SHARE_CLICK", Map.of("target", "native")).andExpect(status().isOk());
        MvcResult started = startParticipation(visitKey, "heart-trace", UUID.randomUUID()).andReturn();
        completeParticipation(json(started).path("participationId").asLong(), visitKey, "pause").andExpect(status().isOk());
        like("heart-trace", visitorKey).andExpect(status().isOk());

        mockMvc.perform(get("/api/engagement/contents/heart-trace/statistics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentViewCount", is(1)))
            .andExpect(jsonPath("$.uniqueViewerCount", is(1)))
            .andExpect(jsonPath("$.participationCount", is(1)))
            .andExpect(jsonPath("$.participantCount", is(1)))
            .andExpect(jsonPath("$.completionCount", is(1)))
            .andExpect(jsonPath("$.completionRate", is(100.0)))
            .andExpect(jsonPath("$.likeCount", is(1)))
            .andExpect(jsonPath("$.shareCount", is(1)))
            .andExpect(jsonPath("$.versions[0].results[3].resultCode", is("pause")))
            .andExpect(jsonPath("$.versions[0].results[3].percentage", is(100.0)))
            .andExpect(jsonPath("$.visitors").doesNotExist());
    }

    @Test
    void aggregatesViewsParticipationsLikesAndSharesForEveryPublishedContent() throws Exception {
        var contentCodes = java.util.List.of(
            "heart-trace",
            "balance-game",
            "ideal-world-cup",
            "group-picker",
            "anonymous-sharing"
        );

        for (String contentCode : contentCodes) {
            UUID visitorKey = UUID.randomUUID();
            UUID visitKey = UUID.randomUUID();
            ensureVisitorAndVisit(visitorKey, visitKey);
            event(UUID.randomUUID(), visitKey, contentCode, "CONTENT_VIEW", Map.of()).andExpect(status().isOk());
            event(UUID.randomUUID(), visitKey, contentCode, "CONTENT_VIEW", Map.of()).andExpect(status().isOk());
            event(UUID.randomUUID(), visitKey, contentCode, "SHARE_CLICK", Map.of("target", "copy_link"))
                .andExpect(status().isOk());
            MvcResult started = startParticipation(visitKey, contentCode, UUID.randomUUID())
                .andExpect(status().isOk())
                .andReturn();
            completeParticipation(
                json(started).path("participationId").asLong(),
                visitKey,
                contentCode.equals("heart-trace") ? "bear" : null
            ).andExpect(status().isOk());
            like(contentCode, visitorKey).andExpect(status().isOk());
            like(contentCode, visitorKey).andExpect(status().isOk());

            mockMvc.perform(get("/api/engagement/contents/{contentCode}/statistics", contentCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentViewCount", is(2)))
                .andExpect(jsonPath("$.uniqueViewerCount", is(1)))
                .andExpect(jsonPath("$.participationCount", is(1)))
                .andExpect(jsonPath("$.participantCount", is(1)))
                .andExpect(jsonPath("$.completionCount", is(1)))
                .andExpect(jsonPath("$.likeCount", is(1)))
                .andExpect(jsonPath("$.shareCount", is(1)));
        }

        mockMvc.perform(get("/api/engagement/statistics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visitorCount", is(contentCodes.size())))
            .andExpect(jsonPath("$.visitors").doesNotExist());

        mockMvc.perform(get("/api/engagement/contents/gureumi/statistics"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("CONTENT_NOT_AVAILABLE")));
    }

    private org.springframework.test.web.servlet.ResultActions ensureVisitor(UUID visitorKey) throws Exception {
        return mockMvc.perform(put("/api/engagement/visitors/{visitorKey}", visitorKey)
            .header("X-OnGi-Client", "web"));
    }

    private org.springframework.test.web.servlet.ResultActions ensureVisit(
        UUID visitKey,
        UUID visitorKey,
        String shareCode
    ) throws Exception {
        var payload = new java.util.HashMap<String, Object>();
        payload.put("visitorKey", visitorKey.toString());
        if (shareCode != null) payload.put("shareCode", shareCode);
        return mockMvc.perform(put("/api/engagement/visits/{visitKey}", visitKey)
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)));
    }

    private void ensureVisitorAndVisit(UUID visitorKey, UUID visitKey) throws Exception {
        ensureVisitor(visitorKey).andExpect(status().isOk());
        ensureVisit(visitKey, visitorKey, null).andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions startParticipation(
        UUID visitKey,
        String contentCode,
        UUID requestKey
    ) throws Exception {
        return mockMvc.perform(post("/api/engagement/participations")
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "visitKey", visitKey.toString(),
                "contentCode", contentCode,
                "requestKey", requestKey.toString()
            ))));
    }

    private org.springframework.test.web.servlet.ResultActions completeParticipation(
        long participationId,
        UUID visitKey,
        String resultCode
    ) throws Exception {
        var payload = new java.util.HashMap<String, Object>();
        payload.put("visitKey", visitKey.toString());
        if (resultCode != null) payload.put("resultCode", resultCode);
        return mockMvc.perform(put("/api/engagement/participations/{participationId}/completion", participationId)
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)));
    }

    private org.springframework.test.web.servlet.ResultActions like(String contentCode, UUID visitorKey) throws Exception {
        return like(contentCode, visitorKey, null);
    }

    private org.springframework.test.web.servlet.ResultActions like(
        String contentCode,
        UUID visitorKey,
        String variantCode
    ) throws Exception {
        var payload = new java.util.HashMap<String, Object>();
        payload.put("visitorKey", visitorKey.toString());
        if (variantCode != null) payload.put("variantCode", variantCode);
        return mockMvc.perform(put("/api/engagement/contents/{contentCode}/like", contentCode)
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)));
    }

    private org.springframework.test.web.servlet.ResultActions unlike(String contentCode, UUID visitorKey) throws Exception {
        return unlike(contentCode, visitorKey, null);
    }

    private org.springframework.test.web.servlet.ResultActions unlike(
        String contentCode,
        UUID visitorKey,
        String variantCode
    ) throws Exception {
        var request = delete("/api/engagement/contents/{contentCode}/like", contentCode)
            .queryParam("visitorKey", visitorKey.toString())
            .header("X-OnGi-Client", "web");
        if (variantCode != null) request.queryParam("variant", variantCode);
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions event(
        UUID eventKey,
        UUID visitKey,
        String contentCode,
        String eventType,
        Map<String, String> data
    ) throws Exception {
        return mockMvc.perform(post("/api/engagement/events")
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "eventKey", eventKey.toString(),
                "visitKey", visitKey.toString(),
                "contentCode", contentCode,
                "eventType", eventType,
                "data", data
            ))));
    }

    private void insertShareLink(String code, boolean active, Instant expiresAt) {
        jdbcTemplate.update("""
            INSERT INTO share_link (content_id, code, name, active, expires_at, created_at)
            SELECT id, ?, ?, ?, CAST(? AS timestamptz), CURRENT_TIMESTAMP FROM content WHERE code = 'heart-trace'
            """, code, "테스트 공유 링크 " + code, active,
            expiresAt == null ? null : java.sql.Timestamp.from(expiresAt));
    }

    private int count(String table) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private java.util.List<String> columns(String table) {
        return jdbcTemplate.queryForList("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            """, String.class, table);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
