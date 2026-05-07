-- +goose Up
-- +goose StatementBegin

-- Email and password become optional so anonymous users and social-only
-- accounts (Apple/Google) can exist. The CHECK constraint below enforces
-- that every user has at least one identity path.
ALTER TABLE users
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false,
    ADD COLUMN apple_sub  text UNIQUE,
    ADD COLUMN google_sub text UNIQUE;

ALTER TABLE users
    ADD CONSTRAINT users_identity_required CHECK (
        is_anonymous = true
        OR email IS NOT NULL
        OR apple_sub IS NOT NULL
        OR google_sub IS NOT NULL
    );

-- Lookups by social subject — UNIQUE already creates an index but we name
-- them for clarity in EXPLAIN output.
CREATE INDEX IF NOT EXISTS users_apple_sub_idx  ON users (apple_sub)  WHERE apple_sub  IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub) WHERE google_sub IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Refuse to roll back if any rows would violate the restored NOT NULLs or
-- if any social/anonymous-only accounts exist; this prevents silent data
-- loss in environments that already used the new flows.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users
        WHERE email IS NULL
           OR password_hash IS NULL
           OR is_anonymous = true
           OR apple_sub IS NOT NULL
           OR google_sub IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'cannot roll back 00010: rows depend on nullable email/password or social subjects';
    END IF;
END $$;

DROP INDEX IF EXISTS users_google_sub_idx;
DROP INDEX IF EXISTS users_apple_sub_idx;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_identity_required;

ALTER TABLE users
    DROP COLUMN IF EXISTS google_sub,
    DROP COLUMN IF EXISTS apple_sub,
    DROP COLUMN IF EXISTS is_anonymous;

ALTER TABLE users
    ALTER COLUMN password_hash SET NOT NULL,
    ALTER COLUMN email SET NOT NULL;

-- +goose StatementEnd
