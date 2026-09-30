package app.ongi.sharing.manitto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ManittoDtos {
    private ManittoDtos() {}
    public record Create(@NotBlank @Size(max = 60) String title,
                         @NotBlank @Size(max = 30) String name, boolean participating) {}
    public record Join(@NotBlank @Size(max = 30) String name) {}
    public record MissionInput(@NotNull UUID id, @NotBlank @Size(max = 500) String content) {}
    public record CompletionInput(@NotNull Boolean completed) {}
    public record Me(UUID id, String name, boolean host, boolean participating, String recipient) {}
    public record Mission(UUID id, String content, Instant createdAt, boolean completed) {}
    public record Progress(UUID id, String name, List<UUID> completedMissionIds) {}
    public record State(String code, String title, boolean assigned, Instant expiresAt, Me me,
                        int participantCount, List<Mission> missions, List<Progress> dashboard) {}
    public record Session(State state, String token) {}
}
