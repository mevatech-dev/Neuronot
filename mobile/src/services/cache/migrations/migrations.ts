import type * as SQLite from 'expo-sqlite';

import { SCHEMA_SQL } from '../schema';

/**
 * Versioned schema migrations. SQLite tracks `PRAGMA user_version` for us.
 * Append future versions as new entries; never edit a released one.
 */
type Migration = {
  version: number;
  apply: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    apply: async (db) => {
      await db.execAsync(SCHEMA_SQL);
    },
  },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = result?.user_version ?? 0;

  for (const m of migrations) {
    if (m.version > current) {
      await m.apply(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    }
  }
}
