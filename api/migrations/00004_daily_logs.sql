-- +goose Up
-- +goose StatementBegin
CREATE TABLE daily_logs (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    focus          int  NOT NULL CHECK (focus BETWEEN 1 AND 5),
    energy         int  NOT NULL CHECK (energy BETWEEN 1 AND 5),
    forgetfulness  int  NOT NULL CHECK (forgetfulness BETWEEN 0 AND 5),
    stress         int  NOT NULL CHECK (stress BETWEEN 0 AND 5),
    sleep_quality  int  NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    logged_at      timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX daily_logs_user_logged_idx ON daily_logs (user_id, logged_at DESC);

-- One log per user per UTC day. The UNIQUE on the cast keeps insertion fast and
-- enforces the "günde bir log" rule from PRD §10.
CREATE UNIQUE INDEX daily_logs_user_day_uniq
    ON daily_logs (user_id, ((logged_at AT TIME ZONE 'UTC')::date));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS daily_logs;
-- +goose StatementEnd
