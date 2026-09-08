package app.ongi.sharing.room;

import app.ongi.sharing.common.StateTransitionException;
import app.ongi.sharing.common.StateTransitionException.Reason;

import java.time.Instant;
import java.util.UUID;

import app.ongi.sharing.question.QuestionSet;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    private UUID id;

    @Column(name = "public_id", nullable = false, unique = true)
    private UUID publicId;

    @Column(nullable = false, unique = true, length = 8)
    private String code;

    @Column(nullable = false, length = 120)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_id", nullable = false)
    private QuestionSet questionSet;

    @Column(name = "current_round", nullable = false)
    private int currentRound;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected Room() {}

    public Room(UUID id, UUID publicId, String code, String title, QuestionSet questionSet, Instant createdAt, Instant expiresAt) {
        this.id = id;
        this.publicId = publicId;
        this.code = code;
        this.title = title;
        this.questionSet = questionSet;
        this.status = RoomStatus.CREATED;
        this.currentRound = 0;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public void markWriting() {
        if (status == RoomStatus.CREATED) {
            status = RoomStatus.WRITING;
        }
    }

    public void lock(long expectedVersion) {
        if (version != expectedVersion) {
            throw new StateTransitionException(Reason.ROOM_VERSION_MISMATCH);
        }
        if (status != RoomStatus.CREATED && status != RoomStatus.WRITING) {
            throw new StateTransitionException(Reason.ROOM_NOT_LOCKABLE);
        }
        status = RoomStatus.LOCKED;
    }

    public void unlock(long expectedVersion) {
        requireVersion(expectedVersion);
        if (status != RoomStatus.LOCKED) {
            throw new StateTransitionException(Reason.ROOM_NOT_UNLOCKABLE);
        }
        status = RoomStatus.WRITING;
    }

    public void requireCancellable(long expectedVersion) {
        requireVersion(expectedVersion);
        if (status != RoomStatus.CREATED && status != RoomStatus.WRITING && status != RoomStatus.LOCKED) {
            throw new StateTransitionException(Reason.ROOM_NOT_CANCELLABLE);
        }
    }

    public void startSharing(long expectedVersion) {
        requireVersion(expectedVersion);
        if (status != RoomStatus.LOCKED) {
            throw new StateTransitionException(Reason.ROOM_NOT_READY_FOR_SHARING);
        }
        status = RoomStatus.SHARING;
        currentRound = 0;
    }

    public void advanceRound(long expectedVersion, int expectedRound, int totalRounds) {
        requireVersion(expectedVersion);
        if (status != RoomStatus.SHARING || currentRound != expectedRound || currentRound >= totalRounds) {
            throw new StateTransitionException(Reason.ROUND_CHANGED);
        }
        currentRound += 1;
    }

    public void complete(Instant now, long expectedVersion, int totalRounds) {
        requireVersion(expectedVersion);
        if (status != RoomStatus.SHARING || currentRound < totalRounds) {
            throw new StateTransitionException(Reason.SHARING_NOT_FINISHED);
        }
        status = RoomStatus.COMPLETED;
        completedAt = now;
    }

    private void requireVersion(long expectedVersion) {
        if (version != expectedVersion) {
            throw new StateTransitionException(Reason.ROOM_VERSION_MISMATCH);
        }
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    public UUID getId() { return id; }
    public UUID getPublicId() { return publicId; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public RoomStatus getStatus() { return status; }
    public QuestionSet getQuestionSet() { return questionSet; }
    public int getCurrentRound() { return currentRound; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
