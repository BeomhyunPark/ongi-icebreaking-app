package app.ongi.sharing.participant;

import java.time.Instant;
import java.util.UUID;

import app.ongi.sharing.room.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "participants")
public class Participant {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(name = "normalized_name", nullable = false, length = 80)
    private String normalizedName;

    @Column(name = "response_completed", nullable = false)
    private boolean responseCompleted;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected Participant() {}

    public Participant(UUID id, Room room, String name, String normalizedName, Instant joinedAt) {
        this.id = id;
        this.room = room;
        this.name = name;
        this.normalizedName = normalizedName;
        this.responseCompleted = false;
        this.joinedAt = joinedAt;
    }

    public void reopenResponses() {
        this.responseCompleted = false;
    }

    public void completeResponses() {
        this.responseCompleted = true;
    }

    public UUID getId() { return id; }
    public Room getRoom() { return room; }
    public String getName() { return name; }
    public String getNormalizedName() { return normalizedName; }
    public boolean isResponseCompleted() { return responseCompleted; }
    public Instant getJoinedAt() { return joinedAt; }
}
