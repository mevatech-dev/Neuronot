/**
 * SQLite schema for the local cache. Every syncable table mirrors the server
 * column set verbatim and adds two local-only columns: `dirty` (push queue)
 * and `local_updated_at` (the moment the row was last touched on the device).
 *
 * Indexes mirror the server's "list by user, ordered by time" + a partial
 * index on `dirty=1` so the push queue scan is O(dirty rows).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  focus INTEGER NOT NULL,
  energy INTEGER NOT NULL,
  forgetfulness INTEGER NOT NULL,
  stress INTEGER NOT NULL,
  sleep_quality INTEGER NOT NULL,
  logged_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0,
  local_updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS daily_logs_user_logged_idx ON daily_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS daily_logs_dirty_idx ON daily_logs (user_id) WHERE dirty = 1;

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  intensity INTEGER NOT NULL,
  note TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0,
  local_updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user_occurred_idx ON events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_dirty_idx ON events (user_id) WHERE dirty = 1;

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL,
  crisis INTEGER NOT NULL DEFAULT 0,
  source_event_ids TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  viewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS insights_user_generated_idx ON insights (user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS profile (
  user_id TEXT PRIMARY KEY,
  focus_problem TEXT,
  intensity_level INTEGER,
  avg_sleep_hours REAL,
  caffeine_daily INTEGER,
  onboarding_completed_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  reminder_hour INTEGER,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  local_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
