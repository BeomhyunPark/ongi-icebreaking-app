package app.ongi.sharing.engagement;

import static app.ongi.sharing.engagement.EngagementDtos.CompleteParticipationRequest;
import static app.ongi.sharing.engagement.EngagementDtos.ContentResponse;
import static app.ongi.sharing.engagement.EngagementDtos.ContentStatisticsResponse;
import static app.ongi.sharing.engagement.EngagementDtos.EnsureVisitRequest;
import static app.ongi.sharing.engagement.EngagementDtos.EventRequest;
import static app.ongi.sharing.engagement.EngagementDtos.EventResponse;
import static app.ongi.sharing.engagement.EngagementDtos.LikeRequest;
import static app.ongi.sharing.engagement.EngagementDtos.LikeResponse;
import static app.ongi.sharing.engagement.EngagementDtos.ParticipationResponse;
import static app.ongi.sharing.engagement.EngagementDtos.ShareLinkResponse;
import static app.ongi.sharing.engagement.EngagementDtos.StartParticipationRequest;
import static app.ongi.sharing.engagement.EngagementDtos.VisitResponse;
import static app.ongi.sharing.engagement.EngagementDtos.VisitorResponse;
import static app.ongi.sharing.engagement.EngagementDtos.VisitorStatisticsResponse;

import app.ongi.sharing.security.AdminAccessService;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/engagement")
public class EngagementController {

    private final EngagementService engagementService;
    private final EngagementStatisticsService statisticsService;
    private final AdminAccessService adminAccessService;

    public EngagementController(
        EngagementService engagementService,
        EngagementStatisticsService statisticsService,
        AdminAccessService adminAccessService
    ) {
        this.engagementService = engagementService;
        this.statisticsService = statisticsService;
        this.adminAccessService = adminAccessService;
    }

    @PutMapping("/visitors/{visitorKey}")
    VisitorResponse ensureVisitor(@PathVariable UUID visitorKey) {
        return engagementService.ensureVisitor(visitorKey);
    }

    @PutMapping("/visits/{visitKey}")
    VisitResponse ensureVisit(@PathVariable UUID visitKey, @Valid @RequestBody EnsureVisitRequest request) {
        return engagementService.ensureVisit(visitKey, request);
    }

    @GetMapping("/contents/{contentCode}")
    ContentResponse content(@PathVariable String contentCode) {
        return engagementService.content(contentCode);
    }

    @PostMapping("/participations")
    ParticipationResponse startParticipation(@Valid @RequestBody StartParticipationRequest request) {
        return engagementService.startParticipation(request);
    }

    @PutMapping("/participations/{participationId}/completion")
    ParticipationResponse completeParticipation(
        @PathVariable Long participationId,
        @Valid @RequestBody CompleteParticipationRequest request
    ) {
        return engagementService.completeParticipation(participationId, request);
    }

    @GetMapping("/contents/{contentCode}/like")
    LikeResponse likeStatus(
        @PathVariable String contentCode,
        @RequestParam UUID visitorKey,
        @RequestParam(required = false) String variant
    ) {
        return engagementService.likeStatus(contentCode, visitorKey, variant);
    }

    @PutMapping("/contents/{contentCode}/like")
    LikeResponse like(@PathVariable String contentCode, @Valid @RequestBody LikeRequest request) {
        return engagementService.like(contentCode, request.visitorKey(), request.variantCode());
    }

    @DeleteMapping("/contents/{contentCode}/like")
    LikeResponse unlike(
        @PathVariable String contentCode,
        @RequestParam UUID visitorKey,
        @RequestParam(required = false) String variant
    ) {
        return engagementService.unlike(contentCode, visitorKey, variant);
    }

    @PostMapping("/events")
    EventResponse event(@Valid @RequestBody EventRequest request) {
        return engagementService.recordEvent(request);
    }

    @GetMapping("/statistics")
    VisitorStatisticsResponse visitorStatistics() {
        return statisticsService.visitorStatistics();
    }

    @GetMapping("/contents/{contentCode}/statistics")
    ContentStatisticsResponse contentStatistics(
        @PathVariable String contentCode,
        @RequestHeader(name = "X-OnGi-Admin-Key", required = false) String adminKey
    ) {
        adminAccessService.requireAccess(adminKey);
        return statisticsService.contentStatistics(contentCode);
    }

    @GetMapping("/internal/dashboard")
    EngagementStatisticsService.DashboardStatistics dashboard(
        @RequestParam(defaultValue = "30") int days,
        @RequestHeader(name = "X-OnGi-Admin-Key", required = false) String adminKey
    ) {
        adminAccessService.requireAccess(adminKey);
        return statisticsService.dashboardStatistics(days);
    }

    @GetMapping("/share-links/{code}")
    ShareLinkResponse shareLink(@PathVariable String code) {
        return engagementService.shareLink(code);
    }
}
