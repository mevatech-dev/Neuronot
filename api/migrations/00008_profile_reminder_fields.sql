-- +goose Up
-- +goose StatementBegin
ALTER TABLE profiles
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN reminder_hour SMALLINT NULL CHECK (reminder_hour BETWEEN 0 AND 23),
  ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE profiles
  DROP COLUMN IF EXISTS reminder_enabled,
  DROP COLUMN IF EXISTS reminder_hour,
  DROP COLUMN IF EXISTS timezone;
-- +goose StatementEnd
