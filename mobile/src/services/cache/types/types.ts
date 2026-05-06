/**
 * Cache-layer mirror types. Field set tracks the server schema 1:1 plus two
 * local-only columns (`dirty`, `local_updated_at`) that drive sync push.
 *
 * `dirty` semantics:
 *   0 = synced with server (fromServer:true upserts mark this)
 *   1 = local change pending push
 *
 * Times are stored as ISO 8601 strings to match what the server sends.
 */

export type DirtyFlag = 0 | 1;

export type DailyLogRow = {
  id: string;
  user_id: string;
  focus: number;
  energy: number;
  forgetfulness: number;
  stress: number;
  sleep_quality: number;
  logged_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: DirtyFlag;
  local_updated_at: string;
};

export type EventRow = {
  id: string;
  user_id: string;
  type: string;
  intensity: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: DirtyFlag;
  local_updated_at: string;
};

export type InsightRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  language: string;
  crisis: 0 | 1;
  source_event_ids: string; // JSON array as text — SQLite doesn't store arrays
  generated_at: string;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  user_id: string;
  focus_problem: string | null;
  intensity_level: number | null;
  avg_sleep_hours: number | null;
  caffeine_daily: 0 | 1 | null;
  onboarding_completed_at: string | null;
  timezone: string;
  reminder_hour: number | null;
  reminder_enabled: 0 | 1;
  created_at: string;
  updated_at: string;
  dirty: DirtyFlag;
  local_updated_at: string;
};

/** Generic upsert options used by every cache repo. */
export type UpsertOptions = {
  /**
   * `true` when the row comes from the server (pull) → mark synced.
   * `false` when the row is a local mutation → mark dirty for push.
   */
  fromServer: boolean;
};
