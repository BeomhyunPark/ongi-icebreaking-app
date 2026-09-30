package app.ongi.sharing.room;

import static app.ongi.sharing.room.RoomDtos.CreateRoomRequest;
import static app.ongi.sharing.room.RoomDtos.CreateRoomResponse;
import static app.ongi.sharing.room.RoomDtos.LockRoomRequest;
import static app.ongi.sharing.room.RoomDtos.RoomStateResponse;
import static app.ongi.sharing.room.RoomDtos.CancelRoomResponse;

import java.time.Clock;
import java.util.UUID;

import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomAuthorizationService;
import app.ongi.sharing.session.SessionCookieService;
import app.ongi.sharing.session.SessionRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final RoomAuthorizationService authorizationService;
    private final SessionCookieService cookieService;
    private final Clock clock;

    public RoomController(RoomService roomService, RoomAuthorizationService authorizationService, SessionCookieService cookieService, Clock clock) {
        this.roomService = roomService;
        this.authorizationService = authorizationService;
        this.cookieService = cookieService;
        this.clock = clock;
    }

    @PostMapping
    ResponseEntity<CreateRoomResponse> create(@Valid @RequestBody CreateRoomRequest request) {
        RoomService.CreatedRoom created = roomService.create(request.title());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookieService.create(
                SessionRole.HOST, created.rawToken(), created.response().roomId(), created.response().expiresAt(), clock.instant()
            ).toString())
            .body(created.response());
    }

    @GetMapping("/{roomId}/state")
    RoomStateResponse state(@PathVariable UUID roomId, @RequestParam(required = false) String roomCode, HttpServletRequest request) {
        return roomService.state(authorizationService.requireAny(request, roomId), roomCode);
    }

    @PostMapping("/{roomId}/lock")
    RoomStateResponse lock(@PathVariable UUID roomId, @Valid @RequestBody LockRoomRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return roomService.lock(access, body.expectedVersion());
    }

    @PostMapping("/{roomId}/unlock")
    RoomStateResponse unlock(@PathVariable UUID roomId, @Valid @RequestBody LockRoomRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return roomService.unlock(access, body.expectedVersion());
    }

    @PostMapping("/{roomId}/cancel")
    ResponseEntity<CancelRoomResponse> cancel(@PathVariable UUID roomId, @Valid @RequestBody LockRoomRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        CancelRoomResponse response = roomService.cancel(access, body.expectedVersion());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE,
                cookieService.clear(SessionRole.HOST, roomId).toString(),
                cookieService.clear(SessionRole.PARTICIPANT, roomId).toString())
            .body(response);
    }
}
