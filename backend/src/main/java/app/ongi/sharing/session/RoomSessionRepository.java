package app.ongi.sharing.session;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

public interface RoomSessionRepository extends JpaRepository<RoomSession, UUID> {

    @EntityGraph(attributePaths = {"room", "participant"})
    Optional<RoomSession> findByTokenHashAndRoomPublicId(String tokenHash, UUID publicRoomId);

    void deleteAllByRoomIdAndParticipantId(UUID roomId, UUID participantId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update RoomSession session
           set session.participant = null,
               session.expiresAt = :expiresAt
         where session.room.id = :roomId
        """)
    int detachParticipantsAndExpireAt(@Param("roomId") UUID roomId, @Param("expiresAt") Instant expiresAt);
}
