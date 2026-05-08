-- +goose Up

-- citext is loaded here (in addition to infra/postgres/init.sql) so the
-- migration runs on managed Postgres deployments where init.sql is not
-- executed. CREATE EXTENSION IF NOT EXISTS is idempotent and self-service
-- on the major managed providers (Neon, Supabase, RDS, Hetzner).
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT uuidv7(),
    email              citext UNIQUE NOT NULL,
    password_hash      text NOT NULL,
    preferred_language text NOT NULL DEFAULT 'en',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_created_at_idx ON users (created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS users;
