package app.ongi.sharing.response;

import static app.ongi.sharing.response.ResponseDtos.MyResponsesResponse;
import static app.ongi.sharing.response.ResponseDtos.QuestionListResponse;
import static app.ongi.sharing.response.ResponseDtos.SaveResponsesRequest;

import java.util.UUID;

import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomAuthorizationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rooms/{roomId}")
public class ResponseController {

    private final ResponseService responseService;
    private final RoomAuthorizationService authorizationService;

    public ResponseController(ResponseService responseService, RoomAuthorizationService authorizationService) {
        this.responseService = responseService;
        this.authorizationService = authorizationService;
    }

    @GetMapping("/questions")
    QuestionListResponse questions(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return responseService.questions(access);
    }

    @GetMapping("/responses/me")
    MyResponsesResponse mine(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return responseService.mine(access);
    }

    @PutMapping("/responses")
    MyResponsesResponse save(@PathVariable UUID roomId, @Valid @RequestBody SaveResponsesRequest body, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return responseService.save(access, body.answers());
    }

    @PostMapping("/responses/reopen")
    MyResponsesResponse reopen(@PathVariable UUID roomId, HttpServletRequest request) {
        return responseService.reopen(authorizationService.requireParticipant(request, roomId));
    }

    @PostMapping("/responses/complete")
    MyResponsesResponse complete(@PathVariable UUID roomId, HttpServletRequest request) {
        RoomAccess access = authorizationService.requireParticipant(request, roomId);
        return responseService.complete(access);
    }
}
