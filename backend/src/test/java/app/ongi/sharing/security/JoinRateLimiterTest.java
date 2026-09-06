package app.ongi.sharing.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import app.ongi.sharing.common.RateLimitException;
import app.ongi.sharing.config.OngiProperties;
import app.ongi.sharing.session.SessionTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class JoinRateLimiterTest {

    @Test
    void limitsRepeatedRoomCodeAttemptsFromSameSource() {
        OngiProperties properties = new OngiProperties(
            List.of("http://localhost:5173"),
            new OngiProperties.Admin("test-admin-key"),
            new OngiProperties.Session(false, Duration.ofHours(24)),
            new OngiProperties.Room(Duration.ofHours(12), 2, 10),
            new OngiProperties.Realtime(Duration.ofMinutes(10), Duration.ofSeconds(20)),
            new OngiProperties.RateLimit(1, false)
        );
        JoinRateLimiter limiter = new JoinRateLimiter(
            properties,
            new SessionTokenService(),
            Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC)
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Forwarded-For", "198.51.100.1");
        request.addHeader("CF-Connecting-IP", "198.51.100.2");

        limiter.check(request, "7KFM-3QPX");

        assertThatThrownBy(() -> limiter.check(request, "7KFM-3QPX"))
            .isInstanceOf(RateLimitException.class);
    }

    @Test
    void usesCloudflareConnectingIpOnlyWhenExplicitlyTrusted() {
        OngiProperties properties = new OngiProperties(
            List.of("https://ongi.greengroove.app"),
            new OngiProperties.Admin("test-admin-key"),
            new OngiProperties.Session(true, Duration.ofHours(24)),
            new OngiProperties.Room(Duration.ofHours(12), 2, 10),
            new OngiProperties.Realtime(Duration.ofMinutes(10), Duration.ofSeconds(20)),
            new OngiProperties.RateLimit(1, true)
        );
        JoinRateLimiter limiter = new JoinRateLimiter(
            properties,
            new SessionTokenService(),
            Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC)
        );
        MockHttpServletRequest first = new MockHttpServletRequest();
        first.setRemoteAddr("172.18.0.4");
        first.addHeader("CF-Connecting-IP", "203.0.113.7");
        MockHttpServletRequest second = new MockHttpServletRequest();
        second.setRemoteAddr("172.18.0.4");
        second.addHeader("CF-Connecting-IP", "203.0.113.8");

        limiter.check(first, "7KFM-3QPX");
        limiter.check(second, "7KFM-3QPX");

        assertThatThrownBy(() -> limiter.check(first, "7KFM-3QPX"))
            .isInstanceOf(RateLimitException.class);
    }

    @Test
    void doesNotLimitAttemptsAcrossDifferentRoomCodes() {
        OngiProperties properties = new OngiProperties(
            List.of("https://ongi.greengroove.app"),
            new OngiProperties.Admin("test-admin-key"),
            new OngiProperties.Session(true, Duration.ofHours(24)),
            new OngiProperties.Room(Duration.ofHours(12), 2, 10),
            new OngiProperties.Realtime(Duration.ofMinutes(10), Duration.ofSeconds(20)),
            new OngiProperties.RateLimit(1, false)
        );
        JoinRateLimiter limiter = new JoinRateLimiter(
            properties,
            new SessionTokenService(),
            Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC)
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");

        limiter.check(request, "7KFM-3QPX");
        limiter.check(request, "8NGT-4RWY");
    }
}
