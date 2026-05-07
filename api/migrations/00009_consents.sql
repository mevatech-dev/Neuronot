-- +goose Up
CREATE TABLE consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('ai_usage','terms_of_service','privacy_policy')),
  granted             boolean NOT NULL,
  version             text NOT NULL,
  source              text NOT NULL CHECK (source IN ('register','settings','reconsent')),
  ip_encrypted        bytea,
  device_id_encrypted bytea,
  user_agent          text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consents_user_type_occurred_idx
  ON consents (user_id, type, occurred_at DESC);

-- +goose Down
DROP INDEX IF EXISTS consents_user_type_occurred_idx;
DROP TABLE IF EXISTS consents;
