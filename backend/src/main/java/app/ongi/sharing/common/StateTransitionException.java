package app.ongi.sharing.common;

/** A domain rule violation, independent of HTTP response codes and copy. */
public final class StateTransitionException extends IllegalStateException {
    public enum Reason {
        ROOM_VERSION_MISMATCH,
        ROOM_NOT_LOCKABLE,
        ROOM_NOT_UNLOCKABLE,
        ROOM_NOT_CANCELLABLE,
        ROOM_NOT_READY_FOR_SHARING,
        ROUND_CHANGED,
        ROUND_NOT_REVEALED,
        SHARING_NOT_FINISHED
    }

    private final Reason reason;

    public StateTransitionException(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
