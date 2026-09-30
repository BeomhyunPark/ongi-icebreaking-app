CREATE TABLE manitto_rooms (
    code varchar(12) PRIMARY KEY,
    title varchar(60) NOT NULL,
    assigned boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL
);
CREATE INDEX manitto_rooms_expiry ON manitto_rooms(expires_at);

CREATE TABLE manitto_members (
    id uuid PRIMARY KEY,
    room_code varchar(12) NOT NULL REFERENCES manitto_rooms(code) ON DELETE CASCADE,
    name varchar(30) NOT NULL,
    host boolean NOT NULL,
    participating boolean NOT NULL,
    token_hash varchar(64) NOT NULL,
    recipient_id uuid,
    UNIQUE (room_code, name),
    UNIQUE (room_code, token_hash),
    UNIQUE (room_code, id),
    UNIQUE (room_code, recipient_id),
    CHECK (recipient_id IS NULL OR recipient_id <> id),
    FOREIGN KEY (room_code, recipient_id) REFERENCES manitto_members(room_code, id)
);
CREATE TABLE manitto_missions (
    id uuid PRIMARY KEY,
    room_code varchar(12) NOT NULL REFERENCES manitto_rooms(code) ON DELETE CASCADE,
    content varchar(500) NOT NULL,
    created_at timestamptz NOT NULL,
    UNIQUE (room_code, id)
);
CREATE TABLE manitto_completions (
    room_code varchar(12) NOT NULL,
    mission_id uuid NOT NULL,
    member_id uuid NOT NULL,
    PRIMARY KEY (mission_id, member_id),
    FOREIGN KEY (room_code, mission_id) REFERENCES manitto_missions(room_code, id) ON DELETE CASCADE,
    FOREIGN KEY (room_code, member_id) REFERENCES manitto_members(room_code, id) ON DELETE CASCADE
);
