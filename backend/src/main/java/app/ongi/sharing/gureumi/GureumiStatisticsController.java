package app.ongi.sharing.gureumi;

import static app.ongi.sharing.gureumi.GureumiStatisticsDtos.StatisticsResponse;

import app.ongi.sharing.security.AdminAccessService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gureumi/internal")
class GureumiStatisticsController {

    private final GureumiStatisticsService statisticsService;
    private final AdminAccessService adminAccessService;

    GureumiStatisticsController(
        GureumiStatisticsService statisticsService,
        AdminAccessService adminAccessService
    ) {
        this.statisticsService = statisticsService;
        this.adminAccessService = adminAccessService;
    }

    @GetMapping("/statistics")
    StatisticsResponse statistics(
        @RequestParam(required = false) String version,
        @RequestParam(defaultValue = "true") boolean completedAnswersOnly,
        @RequestParam(defaultValue = "true") boolean firstAttemptOnly,
        @RequestHeader(name = "X-OnGi-Admin-Key", required = false) String adminKey,
        HttpServletResponse response
    ) {
        adminAccessService.requireAccess(adminKey);
        response.setHeader("Cache-Control", "no-store, max-age=0");
        response.setHeader("Pragma", "no-cache");
        return statisticsService.statistics(version, completedAnswersOnly, firstAttemptOnly);
    }
}
