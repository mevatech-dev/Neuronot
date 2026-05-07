-- +goose Up
-- +goose StatementBegin
CREATE TABLE consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('ai_usage','terms_of_service','privacy_policy')),
  granted             boolean NOT NULL,
  version             text NOT NULL CHECK (length(version) BETWEEN 1 AND 32),
  source              text NOT NULL CHECK (source IN ('register','settings','reconsent')),
  ip_encrypted        bytea,
  device_id_encrypted bytea,
  user_agent          text CHECK (user_agent IS NULL OR length(user_agent) <= 512),
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX consents_user_type_occurred_idx
  ON consents (user_id, type, occurred_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS consents_user_type_occurred_idx;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TABLE IF EXISTS consents;
-- +goose StatementEnd
