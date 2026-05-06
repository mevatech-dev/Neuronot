-- +goose Up
-- +goose StatementBegin
CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email              citext UNIQUE NOT NULL,
    password_hash      text NOT NULL,
    preferred_language text NOT NULL DEFAULT 'en',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_created_at_idx ON users (created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
