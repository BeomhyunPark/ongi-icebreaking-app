package app.ongi.sharing.participant;

import static app.ongi.sharing.participant.ParticipantDtos.JoinRoomRequest;
import static app.ongi.sharing.participant.ParticipantDtos.JoinRoomResponse;
import static app.ongi.sharing.participant.ParticipantDtos.ParticipantListResponse;
import static app.ongi.sharing.participant.ParticipantDtos.ParticipantMe;

import java.time.Clock;
import java.util.UUID;
import java.util.Map;

import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomAuthorizationService;
import app.ongi.sharing.session.SessionCookieService;
import app.ongi.sharing.session.SessionRole;
import app.ongi.sharing.security.JoinRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ParticipantController {

    private final ParticipantService participantService;
    private final RoomAuthorizationService authorizationService;
    private final SessionCookieService cookieService;
    private final Clock clock;
    private final JoinRateLimiter joinRateLimiter;

    public ParticipantController(ParticipantService participantService, RoomAuthorizationService authorizationService, SessionCookieService cookieService, Clock clock, JoinRateLimiter joinRateLimiter) {
        this.participantService = participantService;
        this.authorizationService = authorizationService;
        this.cookieService = cookieService;
        this.clock = clock;
        this.joinRateLimiter = joinRateLimiter;
    }

    @PostMapping("/api/room-joins")
    ResponseEntity<JoinRoomResponse> join(@Valid @RequestBody JoinRoomRequest request, HttpServletRequest servletRequest) {
        joinRateLimiter.check(servletRequest, request.roomCode());
        ParticipantService.JoinedParticipant joined = participantService.join(request.roomCode(), request.name());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookieService.create(
                SessionRole.PARTICIPANT, joined.rawToken(), joined.response().roomId(), joined.response().expiresAt(), clock.instant()
            ).toString())
            .body(joined.response());
    }

    @PostMapping("/api/rooms/{roomId}/leave")
    ResponseEntity<Map<String, Boolean>> leave(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireAny(request, roomId);
        participantService.leave(access);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookieService.clear(SessionRole.PARTICIPANT, roomId).toString())
            .body(Map.of("left", true));
    }

    @GetMapping("/api/rooms/{roomId}/participants/me")
    ParticipantMe me(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return participantService.me(access);
    }

    @GetMapping("/api/rooms/{roomId}/participants")
    ParticipantListResponse list(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return participantService.list(access);
    }
}
