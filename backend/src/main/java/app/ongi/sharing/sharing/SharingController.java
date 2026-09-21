package app.ongi.sharing.sharing;

import static app.ongi.sharing.sharing.SharingDtos.CurrentSharingResponse;
import static app.ongi.sharing.sharing.SharingDtos.NextRoundRequest;
import static app.ongi.sharing.sharing.SharingDtos.VersionRequest;
import static app.ongi.sharing.sharing.SharingDtos.CompletedRoomResponse;

import java.util.UUID;

import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomAuthorizationService;
import app.ongi.sharing.session.SessionCookieService;
import app.ongi.sharing.session.SessionRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/rooms/{roomId}")
public class SharingController {

    private final SharingService sharingService;
    private final RoomAuthorizationService authorizationService;
    private final SessionCookieService cookieService;

    public SharingController(SharingService sharingService, RoomAuthorizationService authorizationService, SessionCookieService cookieService) {
        this.sharingService = sharingService;
        this.authorizationService = authorizationService;
        this.cookieService = cookieService;
    }

    @PostMapping("/start-sharing")
    CurrentSharingResponse start(@PathVariable UUID roomId, @Valid @RequestBody VersionRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return sharingService.start(access, body.expectedVersion());
    }

    @GetMapping("/sharing/current")
    CurrentSharingResponse current(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireAny(request, roomId);
        return sharingService.current(access);
    }

    @PostMapping("/sharing/reveal")
    CurrentSharingResponse reveal(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return sharingService.reveal(access);
    }

    @PostMapping("/next")
    CurrentSharingResponse next(@PathVariable UUID roomId, @Valid @RequestBody NextRoundRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return sharingService.next(access, body.expectedVersion(), body.expectedRound());
    }

    @PostMapping("/skip")
    CurrentSharingResponse skip(@PathVariable UUID roomId, @Valid @RequestBody NextRoundRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        return sharingService.skip(access, body.expectedVersion(), body.expectedRound());
    }

    @PostMapping("/complete")
    ResponseEntity<CompletedRoomResponse> complete(@PathVariable UUID roomId, @Valid @RequestBody VersionRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireHost(request, roomId);
        CompletedRoomResponse response = sharingService.complete(access, body.expectedVersion());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE,
                cookieService.clear(SessionRole.HOST, roomId).toString(),
                cookieService.clear(SessionRole.PARTICIPANT, roomId).toString())
            .body(response);
    }
}
