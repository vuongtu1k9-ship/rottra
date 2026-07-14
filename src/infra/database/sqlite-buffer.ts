import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";

// Ensure storage directory exists
const storageDir = path.join(process.cwd(), "storage");
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(storageDir, "buffer.sqlite");
const sqliteDb = new Database(dbPath, { create: true });

// WAL mode for maximum concurrency and safety
sqliteDb.exec("PRAGMA journal_mode = WAL;");
sqliteDb.exec("PRAGMA synchronous = NORMAL;");
sqliteDb.exec("PRAGMA temp_store = MEMORY;");

// Initialize table
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS wal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertStmt = sqliteDb.query("INSERT INTO wal_logs (table_name, payload) VALUES (?, ?)");
const pullStmt = sqliteDb.query("SELECT * FROM wal_logs ORDER BY id ASC LIMIT ?");
const deleteStmt = sqliteDb.query("DELETE FROM wal_logs WHERE id <= ?");
const countStmt = sqliteDb.query("SELECT COUNT(*) as count FROM wal_logs");

export interface WALRecord {
  id: number;
  table_name: string;
  payload: string;
  created_at: string;
}

export const SQLiteBuffer = {
  /**
   * Pushes a transaction/log into the SQLite buffer. Synchronous and very fast (~0.01ms).
   */
  push(tableName: string, payload: any) {
    try {
      insertStmt.run(tableName, JSON.stringify(payload));
    } catch (err) {
      console.error("[SQLiteBuffer] Failed to push to buffer:", err);
    }
  },

  /**
   * Pulls up to `limit` records from the buffer for processing.
   */
  pull(limit = 1000): WALRecord[] {
    try {
      return pullStmt.all(limit) as WALRecord[];
    } catch (err) {
      console.error("[SQLiteBuffer] Failed to pull from buffer:", err);
      return [];
    }
  },

  /**
   * Deletes all records up to the given ID (used after successful flush to Postgres).
   */
  clearUpToId(maxId: number) {
    try {
      deleteStmt.run(maxId);
    } catch (err) {
      console.error("[SQLiteBuffer] Failed to clear buffer:", err);
    }
  },

  /**
   * Returns current backlog size.
   */
  getBacklogSize(): number {
    try {
      const res = countStmt.get() as { count: number };
      return res?.count || 0;
    } catch (err) {
      return 0;
    }
  },
};
