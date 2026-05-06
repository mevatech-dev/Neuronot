-- +goose Up
-- +goose StatementBegin
CREATE TABLE events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         text NOT NULL CHECK (type IN ('headache','brain_fog','forgetfulness','distraction','mental_fatigue')),
    intensity    int  NOT NULL CHECK (intensity BETWEEN 1 AND 5),
    note         text CHECK (note IS NULL OR length(note) <= 500),
    occurred_at  timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_user_occurred_idx ON events (user_id, occurred_at DESC);
CREATE INDEX events_user_type_idx     ON events (user_id, type);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS events;
-- +goose StatementEnd
