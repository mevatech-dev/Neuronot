-- +goose Up
-- +goose StatementBegin
CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS refresh_tokens;
-- +goose StatementEnd
