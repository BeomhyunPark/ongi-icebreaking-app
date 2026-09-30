package app.ongi.sharing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import app.ongi.sharing.manitto.ManittoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ManittoIntegrationTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ManittoService service;
    private final ObjectMapper json = new ObjectMapper();
    @AfterEach void clear() { db.update("DELETE FROM manitto_rooms"); }

    @Test
    void assignmentIsPrivateStableAndOneToOneAndHostSeesOnlyMissionProgress() throws Exception {
        MvcResult created = create(true);
        String code = body(created).get("code").asText();
        String path = path(code);
        Cookie host = cookie(created);
        Cookie first = cookie(join(code, "하나"));
        Cookie second = cookie(join(code, "둘"));
        assertThat(host.isHttpOnly()).isTrue();
        assertThat(host.getPath()).isEqualTo(path);
        assertThat(host.getMaxAge()).isGreaterThan(29 * 86400);
        assertThat(body(created).toString()).doesNotContain("token", "tokenHash");
        mvc.perform(post(path + "/assign").cookie(first).header("X-OnGi-Client", "web"))
            .andExpect(status().isForbidden());
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(post(path + "/assign").cookie(host)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/assign").cookie(host).header("X-OnGi-Client", "web").header("Origin", "https://evil.example"))
            .andExpect(status().isForbidden());
        send(post(path + "/assign").cookie(host), Map.of());
        var recipients = new HashSet<String>();
        for (Cookie session : List.of(host, first, second)) {
            JsonNode state = body(mvc.perform(get(path).cookie(session)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store")).andReturn());
            String recipient = state.at("/me/recipient").asText();
            assertThat(recipient).isNotEqualTo(state.at("/me/name").asText());
            recipients.add(recipient);
            if (session != host) assertThat(state.get("dashboard").size()).isZero();
            else assertThat(state.get("dashboard").toString()).doesNotContain("recipient");
        }
        assertThat(recipients).containsExactlyInAnyOrder("진행자", "하나", "둘");
        String original = body(mvc.perform(get(path).cookie(first)).andReturn()).at("/me/recipient").asText();
        send(post(path + "/assign").cookie(host), Map.of());
        assertThat(body(mvc.perform(get(path).cookie(first)).andReturn()).at("/me/recipient").asText()).isEqualTo(original);
        mvc.perform(post(path + "/join").header("X-OnGi-Client", "web").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"늦은 참가\"}"))
            .andExpect(status().isConflict());
        send(post(path + "/join").cookie(first), Map.of("name", "하나"));
        assertThat(db.queryForObject("SELECT count(*) FROM manitto_members WHERE room_code = ?", Integer.class, code)).isEqualTo(3);

        String missionId = UUID.randomUUID().toString();
        Map<String, String> mission = Map.of("id", missionId, "content", "상대에게 인사하기");
        mvc.perform(post(path + "/missions").cookie(first).header("X-OnGi-Client", "web").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(mission)))
            .andExpect(status().isForbidden());
        send(post(path + "/missions").cookie(host), mission);
        send(post(path + "/missions").cookie(host), mission);
        assertThat(db.queryForObject("SELECT count(*) FROM manitto_missions", Integer.class)).isEqualTo(1);
        send(put(path + "/missions/" + missionId + "/completion").cookie(first), Map.of("completed", true));
        send(put(path + "/missions/" + missionId + "/completion").cookie(first), Map.of("completed", true));
        JsonNode hostState = body(mvc.perform(get(path).cookie(host)).andReturn());
        assertThat(hostState.at("/missions/0/completed").asBoolean()).isFalse();
        assertThat(hostState.get("dashboard").toString()).contains(missionId);
        mvc.perform(get(path).cookie(second)).andExpect(jsonPath("$.missions[0].completed").value(false));
        send(put(path + "/missions/" + missionId + "/completion").cookie(first), Map.of("completed", false));
        assertThat(db.queryForObject("SELECT count(*) FROM manitto_completions", Integer.class)).isZero();
        send(put(path + "/missions/" + missionId + "/completion").cookie(first), Map.of("completed", true));
        send(delete(path).cookie(host), Map.of());
        for (String table : List.of("manitto_rooms", "manitto_members", "manitto_missions", "manitto_completions"))
            assertThat(db.queryForObject("SELECT count(*) FROM " + table, Integer.class)).isZero();
    }

    @Test
    void separateRoomsRejectCrossRoomCredentialsAndMissionIdsAndExpire() throws Exception {
        MvcResult first = create(true);
        MvcResult other = create(false);
        String code = body(first).get("code").asText();
        String otherCode = body(other).get("code").asText();
        Cookie host = cookie(first);
        Cookie otherHost = cookie(other);
        mvc.perform(get(path(code)).cookie(otherHost)).andExpect(status().isUnauthorized());
        mvc.perform(post(path(code) + "/assign").cookie(host).header("X-OnGi-Client", "web")).andExpect(status().isConflict());
        join(code, "참가자");
        join(otherCode, "참가자1"); join(otherCode, "참가자2");
        send(post(path(code) + "/assign").cookie(host), Map.of());
        send(post(path(otherCode) + "/assign").cookie(otherHost), Map.of());
        String missionId = UUID.randomUUID().toString();
        send(post(path(otherCode) + "/missions").cookie(otherHost), Map.of("id", missionId, "content", "다른 방 미션"));
        mvc.perform(put(path(code) + "/missions/" + missionId + "/completion").cookie(host).header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}")).andExpect(status().isNotFound());
        mvc.perform(put(path(otherCode) + "/missions/" + missionId + "/completion").cookie(otherHost).header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}")).andExpect(status().isForbidden());
        db.update("UPDATE manitto_rooms SET expires_at = ? WHERE code = ?", Timestamp.from(Instant.now().minusSeconds(1)), code);
        mvc.perform(get(path(code)).cookie(host)).andExpect(status().isNotFound());
        service.removeExpired();
        assertThat(db.queryForObject("SELECT count(*) FROM manitto_members WHERE room_code = ?", Integer.class, code)).isZero();
        mvc.perform(get(path(otherCode)).cookie(otherHost)).andExpect(status().isOk());
    }

    @Test
    void simultaneousAssignmentsDoNotReassignAndNamesCannotBeDuplicated() throws Exception {
        MvcResult created = create(true);
        String code = body(created).get("code").asText();
        Cookie host = cookie(created);
        join(code, "참가자");
        mvc.perform(post(path(code) + "/join").header("X-OnGi-Client", "web").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\" 참가자 \"}")).andExpect(status().isConflict());
        var a = CompletableFuture.supplyAsync(() -> assign(code, host));
        var b = CompletableFuture.supplyAsync(() -> assign(code, host));
        assertThat(a.join().at("/me/recipient")).isEqualTo(b.join().at("/me/recipient"));
        assertThat(db.queryForObject("SELECT count(*) FROM manitto_members WHERE room_code = ? AND recipient_id IS NOT NULL", Integer.class, code)).isEqualTo(2);
    }
    private JsonNode assign(String code, Cookie cookie) {
        try { return body(send(post(path(code) + "/assign").cookie(cookie), Map.of())); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
    private MvcResult create(boolean participating) throws Exception {
        return send(post("/api/manitto/rooms"), Map.of("title", "마니또 테스트", "name", "진행자", "participating", participating));
    }
    private MvcResult join(String code, String name) throws Exception { return send(post(path(code) + "/join"), Map.of("name", name)); }
    private MvcResult send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.header("X-OnGi-Client", "web").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isOk()).andReturn();
    }
    private JsonNode body(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()); }
    private Cookie cookie(MvcResult result) { return result.getResponse().getCookie("ongi_manitto_session"); }
    private String path(String code) { return "/api/manitto/rooms/" + code; }
}
