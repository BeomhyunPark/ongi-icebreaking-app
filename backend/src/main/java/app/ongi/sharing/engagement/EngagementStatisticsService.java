package app.ongi.sharing.engagement;

import static app.ongi.sharing.engagement.EngagementDtos.ContentStatisticsResponse;
import static app.ongi.sharing.engagement.EngagementDtos.ResultStatistics;
import static app.ongi.sharing.engagement.EngagementDtos.VersionStatistics;
import static app.ongi.sharing.engagement.EngagementDtos.VisitorStatisticsResponse;
import static app.ongi.sharing.engagement.EngagementDtos.VariantLikeStatistics;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.Timestamp;
import java.util.List;

import app.ongi.sharing.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EngagementStatisticsService {

    private static final ZoneId STATISTICS_ZONE = ZoneId.of("Asia/Seoul");

    private final ContentRepository contentRepository;
    private final ContentVersionRepository versionRepository;
    private final ContentLikeRepository likeRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public EngagementStatisticsService(
        ContentRepository contentRepository,
        ContentVersionRepository versionRepository,
        ContentLikeRepository likeRepository,
        ShareLinkRepository shareLinkRepository,
        JdbcTemplate jdbcTemplate,
        Clock clock
    ) {
        this.contentRepository = contentRepository;
        this.versionRepository = versionRepository;
        this.likeRepository = likeRepository;
        this.shareLinkRepository = shareLinkRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ContentStatisticsResponse contentStatistics(String contentCode) {
        Content content = contentRepository.findByCodeAndStatus(contentCode, ContentStatus.PUBLISHED)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONTENT_NOT_AVAILABLE", "현재 공개된 콘텐츠가 아닙니다."));
        Long contentId = content.getId();
        long views = count("SELECT count(*) FROM event_log WHERE content_id = ? AND event_type = 'CONTENT_VIEW'", contentId);
        long uniqueViewers = count("""
            SELECT count(DISTINCT visit.visitor_id)
            FROM event_log event
            JOIN visit ON visit.id = event.visit_id
            WHERE event.content_id = ? AND event.event_type = 'CONTENT_VIEW'
            """, contentId);
        long participations = count("""
            SELECT count(*) FROM participation participation
            JOIN content_version version ON version.id = participation.version_id
            WHERE version.content_id = ?
            """, contentId);
        long participants = count("""
            SELECT count(DISTINCT visit.visitor_id)
            FROM participation participation
            JOIN visit ON visit.id = participation.visit_id
            JOIN content_version version ON version.id = participation.version_id
            WHERE version.content_id = ?
            """, contentId);
        long completions = count("""
            SELECT count(*) FROM participation participation
            JOIN content_version version ON version.id = participation.version_id
            WHERE version.content_id = ? AND participation.completed_at IS NOT NULL
            """, contentId);
        long shares = count("SELECT count(*) FROM event_log WHERE content_id = ? AND event_type = 'SHARE_CLICK'", contentId);
        List<VariantLikeStatistics> variantLikes = LikeVariantPolicy.variants(content.getCode()).stream()
            .map(variantCode -> new VariantLikeStatistics(
                variantCode,
                likeRepository.countByContentIdAndVariantCode(contentId, variantCode)
            ))
            .toList();
        List<VersionStatistics> versions = versionRepository.findAllByContentIdOrderByPublishedAtAsc(contentId).stream()
            .filter(version -> version.getPublishedAt() != null)
            .map(this::versionStatistics)
            .toList();

        return new ContentStatisticsResponse(
            content.getCode(), views, uniqueViewers, participations, participants, completions,
            ratio(completions, participations), likeRepository.countByContentId(contentId), shares,
            variantLikes, versions
        );
    }

    @Transactional(readOnly = true)
    public VisitorStatisticsResponse visitorStatistics() {
        return new VisitorStatisticsResponse(count("SELECT count(*) FROM visitor"));
    }

    @Transactional(readOnly = true)
    public DashboardStatistics dashboardStatistics(int requestedDays) {
        int days = switch (requestedDays) {
            case 7, 30, 90 -> requestedDays;
            default -> 30;
        };
        LocalDate today = LocalDate.now(clock.withZone(STATISTICS_ZONE));
        LocalDate firstDay = today.minusDays(days - 1L);
        Instant start = firstDay.atStartOfDay(STATISTICS_ZONE).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(STATISTICS_ZONE).toInstant();
        Instant todayStart = today.atStartOfDay(STATISTICS_ZONE).toInstant();
        Timestamp startTimestamp = Timestamp.from(start);
        Timestamp endTimestamp = Timestamp.from(end);
        Timestamp todayStartTimestamp = Timestamp.from(todayStart);

        long genericParticipations = count("SELECT count(*) FROM participation WHERE started_at >= ? AND started_at < ?", startTimestamp, endTimestamp);
        long gureumiStarts = count("SELECT count(*) FROM gureumi_attempt WHERE started_at >= ? AND started_at < ?", startTimestamp, endTimestamp);
        long genericCompletions = count("SELECT count(*) FROM participation WHERE completed_at >= ? AND completed_at < ?", startTimestamp, endTimestamp);
        long gureumiCompletions = count("SELECT count(*) FROM gureumi_attempt WHERE completed_at >= ? AND completed_at < ?", startTimestamp, endTimestamp);

        DashboardSummary summary = new DashboardSummary(
            count("SELECT count(*) FROM visitor"),
            count("SELECT count(DISTINCT visitor_id) FROM visit WHERE started_at >= ? AND started_at < ?", startTimestamp, endTimestamp),
            count("SELECT count(DISTINCT visitor_id) FROM visit WHERE started_at >= ? AND started_at < ?", todayStartTimestamp, endTimestamp),
            count("SELECT count(*) FROM visit WHERE started_at >= ? AND started_at < ?", startTimestamp, endTimestamp),
            count("SELECT count(*) FROM event_log WHERE event_type = 'PAGE_VIEW' AND created_at >= ? AND created_at < ?", startTimestamp, endTimestamp),
            count("SELECT count(*) FROM event_log WHERE event_type = 'CONTENT_VIEW' AND created_at >= ? AND created_at < ?", startTimestamp, endTimestamp),
            genericParticipations + gureumiStarts,
            genericCompletions + gureumiCompletions,
            count("SELECT count(*) FROM event_log WHERE event_type = 'SHARE_CLICK' AND created_at >= ? AND created_at < ?", startTimestamp, endTimestamp),
            count("SELECT count(*) FROM content_like")
        );

        List<DailyActivity> daily = jdbcTemplate.query("""
            WITH days(day) AS (
                SELECT generate_series(CAST(? AS date), CAST(? AS date), interval '1 day')::date
            ), visit_daily AS (
                SELECT (started_at AT TIME ZONE 'Asia/Seoul')::date AS day,
                       count(DISTINCT visitor_id) AS visitors,
                       count(*) AS visits
                FROM visit
                WHERE started_at >= ? AND started_at < ?
                GROUP BY 1
            ), event_daily AS (
                SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
                       count(*) FILTER (WHERE event_type = 'PAGE_VIEW') AS page_views,
                       count(*) FILTER (WHERE event_type = 'CONTENT_VIEW') AS content_views,
                       count(*) FILTER (WHERE event_type = 'SHARE_CLICK') AS shares
                FROM event_log
                WHERE created_at >= ? AND created_at < ?
                GROUP BY 1
            ), participation_daily AS (
                SELECT (started_at AT TIME ZONE 'Asia/Seoul')::date AS day, count(*) AS starts
                FROM participation
                WHERE started_at >= ? AND started_at < ?
                GROUP BY 1
            ), completion_daily AS (
                SELECT (completed_at AT TIME ZONE 'Asia/Seoul')::date AS day, count(*) AS completions
                FROM participation
                WHERE completed_at >= ? AND completed_at < ?
                GROUP BY 1
            ), gureumi_start_daily AS (
                SELECT (started_at AT TIME ZONE 'Asia/Seoul')::date AS day, count(*) AS starts
                FROM gureumi_attempt
                WHERE started_at >= ? AND started_at < ?
                GROUP BY 1
            ), gureumi_completion_daily AS (
                SELECT (completed_at AT TIME ZONE 'Asia/Seoul')::date AS day, count(*) AS completions
                FROM gureumi_attempt
                WHERE completed_at >= ? AND completed_at < ?
                GROUP BY 1
            )
            SELECT days.day,
                   COALESCE(visit_daily.visitors, 0) AS visitors,
                   COALESCE(visit_daily.visits, 0) AS visits,
                   COALESCE(event_daily.page_views, 0) AS page_views,
                   COALESCE(event_daily.content_views, 0) AS content_views,
                   COALESCE(event_daily.shares, 0) AS shares,
                   COALESCE(participation_daily.starts, 0) + COALESCE(gureumi_start_daily.starts, 0) AS participations,
                   COALESCE(completion_daily.completions, 0) + COALESCE(gureumi_completion_daily.completions, 0) AS completions
            FROM days
            LEFT JOIN visit_daily ON visit_daily.day = days.day
            LEFT JOIN event_daily ON event_daily.day = days.day
            LEFT JOIN participation_daily ON participation_daily.day = days.day
            LEFT JOIN completion_daily ON completion_daily.day = days.day
            LEFT JOIN gureumi_start_daily ON gureumi_start_daily.day = days.day
            LEFT JOIN gureumi_completion_daily ON gureumi_completion_daily.day = days.day
            ORDER BY days.day
            """, (resultSet, rowNumber) -> new DailyActivity(
                resultSet.getObject("day", LocalDate.class),
                resultSet.getLong("visitors"),
                resultSet.getLong("visits"),
                resultSet.getLong("page_views"),
                resultSet.getLong("content_views"),
                resultSet.getLong("participations"),
                resultSet.getLong("completions"),
                resultSet.getLong("shares")
            ), firstDay, today, startTimestamp, endTimestamp, startTimestamp, endTimestamp,
            startTimestamp, endTimestamp, startTimestamp, endTimestamp, startTimestamp, endTimestamp,
            startTimestamp, endTimestamp);

        List<ContentPerformance> contents = jdbcTemplate.query("""
            SELECT content.code, content.name, content.type, content.status,
                   (SELECT count(*) FROM event_log event
                    WHERE event.content_id = content.id AND event.event_type = 'CONTENT_VIEW'
                      AND event.created_at >= ? AND event.created_at < ?) AS views,
                   (SELECT count(DISTINCT visit.visitor_id) FROM event_log event
                    JOIN visit ON visit.id = event.visit_id
                    WHERE event.content_id = content.id AND event.event_type = 'CONTENT_VIEW'
                      AND event.created_at >= ? AND event.created_at < ?) AS viewers,
                   CASE WHEN content.code = 'gureumi' THEN
                       (SELECT count(*) FROM gureumi_attempt WHERE started_at >= ? AND started_at < ?)
                   ELSE
                       (SELECT count(*) FROM participation p JOIN content_version v ON v.id = p.version_id
                        WHERE v.content_id = content.id AND p.started_at >= ? AND p.started_at < ?)
                   END AS participations,
                   CASE WHEN content.code = 'gureumi' THEN
                       (SELECT count(*) FROM gureumi_attempt WHERE completed_at >= ? AND completed_at < ?)
                   ELSE
                       (SELECT count(*) FROM participation p JOIN content_version v ON v.id = p.version_id
                        WHERE v.content_id = content.id AND p.completed_at >= ? AND p.completed_at < ?)
                   END AS completions,
                   (SELECT count(*) FROM event_log event
                    WHERE event.content_id = content.id AND event.event_type = 'SHARE_CLICK'
                      AND event.created_at >= ? AND event.created_at < ?) AS shares,
                   (SELECT count(*) FROM content_like liked WHERE liked.content_id = content.id) AS likes
            FROM content
            WHERE content.status <> 'ARCHIVED'
            ORDER BY views DESC, content.name
            """, (resultSet, rowNumber) -> {
                long participations = resultSet.getLong("participations");
                long completions = resultSet.getLong("completions");
                return new ContentPerformance(
                    resultSet.getString("code"),
                    resultSet.getString("name"),
                    resultSet.getString("type"),
                    resultSet.getString("status"),
                    resultSet.getLong("views"),
                    resultSet.getLong("viewers"),
                    participations,
                    completions,
                    ratio(completions, participations),
                    resultSet.getLong("shares"),
                    resultSet.getLong("likes")
                );
            }, startTimestamp, endTimestamp, startTimestamp, endTimestamp, startTimestamp, endTimestamp,
            startTimestamp, endTimestamp, startTimestamp, endTimestamp, startTimestamp, endTimestamp,
            startTimestamp, endTimestamp);

        return new DashboardStatistics(days, clock.instant(), summary, daily, contents);
    }

    @Transactional(readOnly = true)
    public ShareLinkStatistics shareLinkStatistics(String shareCode) {
        ShareLink link = shareLinkRepository.findByCodeWithContent(shareCode)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SHARE_LINK_NOT_FOUND", "공유 링크를 찾을 수 없습니다."));
        Long linkId = link.getId();
        long visits = count("SELECT count(*) FROM visit WHERE share_link_id = ?", linkId);
        long participations = count("""
            SELECT count(*) FROM participation participation
            JOIN visit ON visit.id = participation.visit_id
            WHERE visit.share_link_id = ?
            """, linkId);
        long completions = count("""
            SELECT count(*) FROM participation participation
            JOIN visit ON visit.id = participation.visit_id
            WHERE visit.share_link_id = ? AND participation.completed_at IS NOT NULL
            """, linkId);
        List<ResultCount> results = jdbcTemplate.query("""
            SELECT result.code, result.name, count(participation.id) AS completion_count
            FROM content_result result
            JOIN participation ON participation.result_id = result.id
            JOIN visit ON visit.id = participation.visit_id
            WHERE visit.share_link_id = ? AND participation.completed_at IS NOT NULL
            GROUP BY result.id, result.code, result.name, result.sort_order
            ORDER BY result.sort_order
            """, (resultSet, rowNumber) -> new ResultCount(
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getLong("completion_count")
            ), linkId);
        return new ShareLinkStatistics(shareCode, visits, participations, completions, results);
    }

    private VersionStatistics versionStatistics(ContentVersion version) {
        long participationCount = count("SELECT count(*) FROM participation WHERE version_id = ?", version.getId());
        long completionCount = count(
            "SELECT count(*) FROM participation WHERE version_id = ? AND completed_at IS NOT NULL",
            version.getId()
        );
        List<ResultStatistics> results = jdbcTemplate.query("""
            SELECT result.code, result.name, count(participation.id) AS completion_count
            FROM content_result result
            LEFT JOIN participation
              ON participation.result_id = result.id
             AND participation.completed_at IS NOT NULL
            WHERE result.version_id = ? AND result.active = TRUE
            GROUP BY result.id, result.code, result.name, result.sort_order
            ORDER BY result.sort_order
            """, (resultSet, rowNumber) -> {
                long resultCompletions = resultSet.getLong("completion_count");
                return new ResultStatistics(
                    resultSet.getString("code"), resultSet.getString("name"), resultCompletions,
                    ratio(resultCompletions, completionCount)
                );
            }, version.getId());
        return new VersionStatistics(version.getVersionNo(), participationCount, completionCount, results);
    }

    private long count(String sql, Object... arguments) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, arguments);
        return value == null ? 0 : value;
    }

    private double ratio(long numerator, long denominator) {
        return denominator == 0 ? 0 : Math.round((numerator * 10000.0) / denominator) / 100.0;
    }

    public record DashboardStatistics(
        int periodDays,
        Instant generatedAt,
        DashboardSummary summary,
        List<DailyActivity> daily,
        List<ContentPerformance> contents
    ) {}

    public record DashboardSummary(
        long totalVisitorCount,
        long periodVisitorCount,
        long todayVisitorCount,
        long visitCount,
        long pageViewCount,
        long contentViewCount,
        long participationCount,
        long completionCount,
        long shareCount,
        long likeCount
    ) {}

    public record DailyActivity(
        LocalDate date,
        long visitorCount,
        long visitCount,
        long pageViewCount,
        long contentViewCount,
        long participationCount,
        long completionCount,
        long shareCount
    ) {}

    public record ContentPerformance(
        String contentCode,
        String name,
        String type,
        String status,
        long viewCount,
        long uniqueViewerCount,
        long participationCount,
        long completionCount,
        double completionRate,
        long shareCount,
        long likeCount
    ) {}

    public record ResultCount(String resultCode, String resultName, long completionCount) {}

    public record ShareLinkStatistics(
        String shareCode,
        long visitCount,
        long participationCount,
        long completionCount,
        List<ResultCount> results
    ) {}
}
