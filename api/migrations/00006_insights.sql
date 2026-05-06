-- +goose Up
-- +goose StatementBegin
CREATE TABLE insights (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
    content          text NOT NULL CHECK (length(content) BETWEEN 1 AND 1600),
    language         text NOT NULL CHECK (length(language) BETWEEN 2 AND 8),
    source_event_ids uuid[] NOT NULL DEFAULT '{}',
    generated_at     timestamptz NOT NULL DEFAULT now(),
    viewed_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insights_user_generated_idx ON insights (user_id, generated_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS insights;
-- +goose StatementEnd
