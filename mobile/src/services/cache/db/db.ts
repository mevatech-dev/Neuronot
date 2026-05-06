import * as SQLite from 'expo-sqlite';

import { runMigrations } from '../migrations';

const DB_NAME = 'neuronot.db';

let dbHandle: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (and migrates) the local SQLite database. Singleton — every caller
 * receives the same handle. Safe to call from multiple effects: concurrent
 * calls await the same `initPromise`.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbHandle) return dbHandle;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    dbHandle = db;
    return db;
  })();

  return initPromise;
}

/**
 * Test/teardown helper — closes the handle so the next `getDb()` re-opens.
 * Production code should not call this.
 */
export async function closeDb(): Promise<void> {
  if (dbHandle) {
    await dbHandle.closeAsync();
    dbHandle = null;
  }
  initPromise = null;
}

/** Read a single sync_state value or fall back. */
export async function readSyncState(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

/** Write a sync_state value (upsert). */
export async function writeSyncState(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
