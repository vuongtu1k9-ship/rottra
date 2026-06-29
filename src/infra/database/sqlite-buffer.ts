import { Database } from "bun:sqlite";
import path from "path";

export interface BufferedTransaction {
  id?: number;
  userId: string;
  type: string;
  amount: number;
  details: string;
  timestamp: number;
}

export class SQLiteBuffer {
  private db: Database;

  constructor() {
    const dbPath = path.join(process.cwd(), "storage", "wal_buffer.sqlite");
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        details TEXT,
        timestamp INTEGER NOT NULL
      )
    `);
    // Enable WAL mode for high concurrent write throughput
    this.db.run("PRAGMA journal_mode = WAL;");
  }

  /**
   * Append a transaction to the WAL buffer.
   */
  public append(tx: BufferedTransaction) {
    const query = this.db.prepare(`
      INSERT INTO transactions (userId, type, amount, details, timestamp)
      VALUES ($userId, $type, $amount, $details, $timestamp)
    `);
    query.run({
      $userId: tx.userId,
      $type: tx.type,
      $amount: tx.amount,
      $details: tx.details,
      $timestamp: tx.timestamp || Date.now(),
    });
  }

  /**
   * Read all buffered transactions and flush/clear them.
   */
  public flush(): BufferedTransaction[] {
    const rows = this.db.query("SELECT * FROM transactions ORDER BY id ASC").all() as any[];
    if (rows.length === 0) return [];

    // Clear the buffer
    this.db.run("DELETE FROM transactions");
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type,
      amount: r.amount,
      details: r.details,
      timestamp: r.timestamp,
    }));
  }

  public getPendingCount(): number {
    const res = this.db.query("SELECT COUNT(*) as count FROM transactions").get() as { count: number };
    return res ? res.count : 0;
  }
}

export const sqliteBuffer = new SQLiteBuffer();
