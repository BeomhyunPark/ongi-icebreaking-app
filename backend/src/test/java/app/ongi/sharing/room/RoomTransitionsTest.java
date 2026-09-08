package app.ongi.sharing.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.UUID;
import app.ongi.sharing.common.StateTransitionException;
import app.ongi.sharing.common.StateTransitionException.Reason;
import org.junit.jupiter.api.Test;

class RoomTransitionsTest {
    private Room room() {
        return new Room(UUID.randomUUID(), UUID.randomUUID(), "ABCDEFGH", "모임", null,
            Instant.EPOCH, Instant.EPOCH.plusSeconds(3600));
    }

    @Test
    void staleVersionIsATypedConflictWithoutChangingTheRoom() {
        Room room = room();
        StateTransitionException error = assertThrows(StateTransitionException.class, () -> room.lock(1));
        assertThat(error.reason()).isEqualTo(Reason.ROOM_VERSION_MISMATCH);
        assertThat(room.getStatus()).isEqualTo(RoomStatus.CREATED);
    }

    @Test
    void preservesTheLockSharingAndCompletionRules() {
        Room room = room();
        assertThat(assertThrows(StateTransitionException.class, () -> room.startSharing(0)).reason())
            .isEqualTo(Reason.ROOM_NOT_READY_FOR_SHARING);
        room.lock(0);
        room.unlock(0);
        assertThat(room.getStatus()).isEqualTo(RoomStatus.WRITING);
        room.lock(0);
        room.startSharing(0);
        assertThat(assertThrows(StateTransitionException.class, () -> room.complete(Instant.EPOCH, 0, 1)).reason())
            .isEqualTo(Reason.SHARING_NOT_FINISHED);
        room.advanceRound(0, 0, 1);
        room.complete(Instant.EPOCH, 0, 1);
        assertThat(room.getStatus()).isEqualTo(RoomStatus.COMPLETED);
    }
}
