-- +goose Up
-- +goose StatementBegin
ALTER TABLE daily_logs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE daily_logs ADD COLUMN deleted_at timestamptz NULL;
ALTER TABLE events     ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE events     ADD COLUMN deleted_at timestamptz NULL;
ALTER TABLE insights   ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_logs_set_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_insights_set_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX daily_logs_user_updated_idx ON daily_logs (user_id, updated_at DESC);
CREATE INDEX events_user_updated_idx     ON events     (user_id, updated_at DESC);
CREATE INDEX insights_user_updated_idx   ON insights   (user_id, updated_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS insights_user_updated_idx;
DROP INDEX IF EXISTS events_user_updated_idx;
DROP INDEX IF EXISTS daily_logs_user_updated_idx;
DROP TRIGGER IF EXISTS trg_insights_set_updated_at ON insights;
DROP TRIGGER IF EXISTS trg_events_set_updated_at ON events;
DROP TRIGGER IF EXISTS trg_daily_logs_set_updated_at ON daily_logs;
DROP FUNCTION IF EXISTS set_updated_at();
ALTER TABLE insights DROP COLUMN IF EXISTS updated_at;
ALTER TABLE events DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE events DROP COLUMN IF EXISTS updated_at;
ALTER TABLE daily_logs DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE daily_logs DROP COLUMN IF EXISTS updated_at;
-- +goose StatementEnd
