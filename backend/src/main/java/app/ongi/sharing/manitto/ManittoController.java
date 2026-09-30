package app.ongi.sharing.manitto;

import static app.ongi.sharing.manitto.ManittoDtos.*;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import app.ongi.sharing.config.OngiProperties;
import app.ongi.sharing.security.JoinRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manitto/rooms")
public class ManittoController {
    private static final String COOKIE = "ongi_manitto_session";
    private final ManittoService service;
    private final OngiProperties properties;
    private final JoinRateLimiter limiter;
    private final Clock clock;
    public ManittoController(ManittoService service, OngiProperties properties, JoinRateLimiter limiter, Clock clock) {
        this.service = service; this.properties = properties; this.limiter = limiter; this.clock = clock;
    }
    @PostMapping
    ResponseEntity<State> create(@Valid @RequestBody Create input, HttpServletRequest request) {
        limiter.check(request, "manitto-create");
        return session(service.create(input));
    }
    @PostMapping("/{code}/join")
    ResponseEntity<State> join(@PathVariable String code, @Valid @RequestBody Join input, HttpServletRequest request) {
        limiter.check(request, "manitto-join");
        return session(service.join(code, token(request), input));
    }
    @GetMapping("/{code}")
    ResponseEntity<State> state(@PathVariable String code, HttpServletRequest request) {
        return response(service.state(code, token(request)));
    }
    @PostMapping("/{code}/assign")
    ResponseEntity<State> assign(@PathVariable String code, HttpServletRequest request) {
        return response(service.assign(code, token(request)));
    }
    @PostMapping("/{code}/missions")
    ResponseEntity<State> mission(@PathVariable String code, @Valid @RequestBody MissionInput input, HttpServletRequest request) {
        return response(service.addMission(code, token(request), input));
    }
    @PutMapping("/{code}/missions/{missionId}/completion")
    ResponseEntity<State> completion(@PathVariable String code, @PathVariable UUID missionId,
                                    @Valid @RequestBody CompletionInput input, HttpServletRequest request) {
        return response(service.complete(code, token(request), missionId, input.completed()));
    }
    @DeleteMapping("/{code}")
    ResponseEntity<Map<String, Boolean>> close(@PathVariable String code, HttpServletRequest request) {
        service.close(code, token(request));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.SET_COOKIE,
            cookie(code, "", Duration.ZERO).toString()).body(Map.of("closed", true));
    }
    private ResponseEntity<State> session(Session session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.SET_COOKIE,
            cookie(session.state().code(), session.token(), Duration.between(clock.instant(), session.state().expiresAt())).toString())
            .body(session.state());
    }
    private ResponseCookie cookie(String code, String token, Duration age) {
        return ResponseCookie.from(COOKIE, token).httpOnly(true).secure(properties.session().secureCookie())
            .sameSite("Lax").path("/api/manitto/rooms/" + code).maxAge(age).build();
    }
    private ResponseEntity<State> response(State state) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(state);
    }
    private String token(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(c -> COOKIE.equals(c.getName())).map(c -> c.getValue()).findFirst().orElse(null);
    }
}
