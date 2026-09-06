package app.ongi.sharing.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import app.ongi.sharing.config.OngiProperties;
import org.junit.jupiter.api.Test;

class RoomEventPublisherTest {

    @Test
    void completingOneRoomDoesNotCloseAnotherRoomsSubscribers() {
        OngiProperties properties = new OngiProperties(
            List.of("http://localhost:5173"),
            new OngiProperties.Admin("test-admin-key"),
            new OngiProperties.Session(false, Duration.ofHours(24)),
            new OngiProperties.Room(Duration.ofHours(12), 2, 10),
            new OngiProperties.Realtime(Duration.ofMinutes(10), Duration.ofSeconds(20)),
            new OngiProperties.RateLimit(5, false)
        );
        RoomEventPublisher publisher = new RoomEventPublisher(
            properties,
            Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC)
        );
        UUID roomA = UUID.randomUUID();
        UUID roomB = UUID.randomUUID();
        publisher.subscribe(roomA);
        publisher.subscribe(roomB);

        publisher.publishAfterCommit(roomA, RoomEventType.ROOM_COMPLETED, 5L);

        assertThat(publisher.subscriberCount(roomA)).isZero();
        assertThat(publisher.subscriberCount(roomB)).isOne();
    }
}
