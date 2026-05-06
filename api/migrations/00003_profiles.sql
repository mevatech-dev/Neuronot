-- +goose Up
-- +goose StatementBegin
CREATE TABLE profiles (
    user_id                 uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    focus_problem           text CHECK (focus_problem IN ('focus','energy','headache','sleep','forgetfulness') OR focus_problem IS NULL),
    intensity_level         int  CHECK (intensity_level BETWEEN 1 AND 5),
    avg_sleep_hours         numeric(3,1),
    caffeine_daily          boolean,
    onboarding_completed_at timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS profiles;
-- +goose StatementEnd
