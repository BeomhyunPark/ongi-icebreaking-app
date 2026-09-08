package app.ongi.sharing.sharing;

import app.ongi.sharing.common.StateTransitionException;
import app.ongi.sharing.common.StateTransitionException.Reason;

import java.time.Instant;
import java.util.UUID;

import app.ongi.sharing.participant.Participant;
import app.ongi.sharing.room.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "sharing_rounds")
public class SharingRound {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    @Column(nullable = false)
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SharingStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "revealed_at")
    private Instant revealedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected SharingRound() {}

    public SharingRound(UUID id, Room room, Participant participant, int sequence, Instant createdAt) {
        this.id = id;
        this.room = room;
        this.participant = participant;
        this.sequence = sequence;
        this.status = SharingStatus.ANONYMOUS;
        this.createdAt = createdAt;
    }

    public void complete(Instant now) {
        if (status != SharingStatus.REVEALED) {
            throw new StateTransitionException(Reason.ROUND_NOT_REVEALED);
        }
        status = SharingStatus.COMPLETED;
        completedAt = now;
    }

    public UUID getId() { return id; }
    public Room getRoom() { return room; }
    public Participant getParticipant() { return participant; }
    public int getSequence() { return sequence; }
    public SharingStatus getStatus() { return status; }
}
