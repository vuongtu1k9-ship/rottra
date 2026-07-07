import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { Database } from "bun:sqlite";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import nativeProcess from "node:process";
import { dbContext } from "./als";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";

// Use the native node:process module object to persist the database client across all Vite HMR/ModuleRunner sandboxes
const globalForDb = nativeProcess as any;

if (!globalForDb._isolateId) {
  globalForDb._isolateId = Math.random().toString(36).substring(7);
  console.log(`[DB INIT] 🚨 NEW ISOLATE DETECTED: ${globalForDb._isolateId}`);
}

function initDb() {
  const isSqlite = process.env.DATABASE_TYPE === "sqlite";

  if (isSqlite) {
    if (globalForDb.sqliteDb) {
      return { client: globalForDb.sqliteClient, db: globalForDb.sqliteDb };
    }
    const dbPath = process.env.SQLITE_DB_PATH || "rottra.db";
    console.log(`[DB INIT] 🔌 Connecting to SQLite database at ${dbPath}...`);
    const sqliteClient = new Database(dbPath);
    sqliteClient.exec("PRAGMA journal_mode = WAL;");
    const dbInstance = drizzleSqlite(sqliteClient, { schema });
    globalForDb.sqliteClient = sqliteClient;
    globalForDb.sqliteDb = dbInstance;
    return { client: sqliteClient, db: dbInstance };
  }

  if (globalForDb.pgDb) {
    return { client: globalForDb.pgClient, db: globalForDb.pgDb };
  }

  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/rottra";
  console.log(`[DB INIT] 🔌 Connecting to PostgreSQL...`);

  const queryClient =
    globalForDb.pgClient ??
    postgres(connectionString, {
      max: 2, // Giảm pool size trên Cloudflare Workers để chống lỗi cạn kiệt Connection (502 Bad Gateway)
      idle_timeout: 3, // Giải phóng connection nhàn rỗi sau 3 giây (đơn vị của postgres.js là giây)
      connect_timeout: 10, // Timeout kết nối 10 giây
      prepare: false,
      onnotice: () => {},
      transform: { undefined: null },
    });
  globalForDb.pgClient = queryClient;

  const dbInstance = drizzle(queryClient, { schema });
  globalForDb.pgDb = dbInstance;

  // Cleanup pool on process exit
  if (typeof process !== "undefined" && !globalForDb.cleanupRegistered) {
    globalForDb.cleanupRegistered = true;
    const cleanup = async (signal: string) => {
      if (globalForDb.pgClient) {
        console.log(`[DB CLEANUP] Closing client on ${signal}...`);
        try {
          await globalForDb.pgClient.end({ timeout: 5 });
          console.log(`[DB CLEANUP] ✅ pgClient closed.`);
        } catch (err) {
          console.error(`[DB CLEANUP] ❌ Error closing pgClient:`, err);
        }
        globalForDb.pgClient = null;
        globalForDb.pgDb = null;
      }
      if (globalForDb.sqliteClient) {
        console.log(`[DB CLEANUP] Closing SQLite client on ${signal}...`);
        try {
          globalForDb.sqliteClient.close();
          console.log(`[DB CLEANUP] ✅ SQLite client closed.`);
        } catch (err) {
          console.error(`[DB CLEANUP] ❌ Error closing SQLite client:`, err);
        }
        globalForDb.sqliteClient = null;
        globalForDb.sqliteDb = null;
      }
    };

    process.on("SIGINT", async () => {
      await cleanup("SIGINT");
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await cleanup("SIGTERM");
      process.exit(0);
    });

    process.on("SIGUSR2", async () => {
      await cleanup("SIGUSR2 (Vite HMR/Reload)");
      process.exit(0);
    });

    process.on("beforeExit", async () => {
      await cleanup("beforeExit");
    });

    process.on("uncaughtException", async (err) => {
      console.error("[CRITICAL DB ACCESS ERROR] Uncaught Exception:", err);
      await cleanup("uncaughtException");
      process.exit(1);
    });
  }

  return { client: queryClient, db: dbInstance };
}

export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const d1Binding = dbContext.getStore();
    if (d1Binding) {
      const d1Db = drizzleD1(d1Binding, { schema });
      if (prop === "execute") {
        return async (...args: any[]) => {
          // Simplistic execute for D1 if needed
          return Reflect.apply((d1Db as any).run, d1Db, args);
        }
      }
      const value = Reflect.get(d1Db, prop);
      return typeof value === "function" ? value.bind(d1Db) : value;
    }

    const { db: activeDb, client: activeClient } = initDb();
    if (prop === "execute") {
      return async (...args: any[]) => {
        if (process.env.DATABASE_TYPE === "sqlite") {
          let sqlArg = args[0];
          let queryStr = "";
          let bindParams: any[] = [];
          if (sqlArg && typeof sqlArg === "object" && sqlArg.sql) {
            queryStr = sqlArg.sql;
            bindParams = sqlArg.params || [];
          } else if (typeof sqlArg === "string") {
            queryStr = sqlArg;
            bindParams = args.slice(1);
          }

          if (queryStr) {
            let sqliteQuery = queryStr;
            sqliteQuery = sqliteQuery.replace(/timestamp with time zone/gi, "TEXT");
            sqliteQuery = sqliteQuery.replace(/varchar\(\d+\)/gi, "TEXT");
            sqliteQuery = sqliteQuery.replace(/jsonb/gi, "TEXT");
            sqliteQuery = sqliteQuery.replace(/double precision/gi, "REAL");
            sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, "?$1");

            const stmt = (activeClient as Database).prepare(sqliteQuery);
            const isSelect = /^\s*select/i.test(sqliteQuery);
            if (isSelect) {
              const rows = stmt.all(...bindParams);
              Object.defineProperty(rows, "rows", {
                get() {
                  return this;
                },
                configurable: true,
                enumerable: false,
              });
              return rows;
            } else {
              const res = stmt.run(...bindParams);
              const wrapRes = { ...res, rows: [] } as any;
              return wrapRes;
            }
          }
        }

        const result = await activeDb.execute(...args);
        if (result && Array.isArray(result)) {
          Object.defineProperty(result, "rows", {
            get() {
              return this;
            },
            configurable: true,
            enumerable: false,
          });
        }
        return result;
      };
    }
    const value = Reflect.get(activeDb, prop);
    return typeof value === "function" ? value.bind(activeDb) : value;
  },
});

export const pgClient = new Proxy((() => {}) as any, {
  apply(target, thisArg, argumentsList) {
    const { client: activeClient } = initDb();
    const isTemplate = Array.isArray(argumentsList[0]) && (argumentsList[0] as any).raw !== undefined;
    if (process.env.DATABASE_TYPE === "sqlite") {
      if (isTemplate) {
        const strings = argumentsList[0];
        const values = argumentsList.slice(1);
        let queryStr = "";
        for (let i = 0; i < strings.length; i++) {
          queryStr += strings[i];
          if (i < values.length) {
            queryStr += `$${i + 1}`;
          }
        }
        let sqliteQuery = queryStr;
        sqliteQuery = sqliteQuery.replace(/timestamp with time zone/gi, "TEXT");
        sqliteQuery = sqliteQuery.replace(/varchar\(\d+\)/gi, "TEXT");
        sqliteQuery = sqliteQuery.replace(/jsonb/gi, "TEXT");
        sqliteQuery = sqliteQuery.replace(/double precision/gi, "REAL");
        sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, "?$1");

        const stmt = (activeClient as Database).prepare(sqliteQuery);
        const isSelect = /^\s*select/i.test(sqliteQuery);
        if (isSelect) {
          return stmt.all(...values);
        } else {
          return stmt.run(...values);
        }
      } else {
        return argumentsList;
      }
    }
    return (activeClient as any)(...argumentsList);
  },
  get(target, prop, receiver) {
    const { client: activeClient } = initDb();
    if (prop === "query") {
      return async (queryString: string, params?: any[]) => {
        if (process.env.DATABASE_TYPE === "sqlite") {
          let sqliteQuery = queryString;
          sqliteQuery = sqliteQuery.replace(/timestamp with time zone/gi, "TEXT");
          sqliteQuery = sqliteQuery.replace(/varchar\(\d+\)/gi, "TEXT");
          sqliteQuery = sqliteQuery.replace(/jsonb/gi, "TEXT");
          sqliteQuery = sqliteQuery.replace(/double precision/gi, "REAL");
          sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, "?$1");

          const stmt = (activeClient as Database).prepare(sqliteQuery);
          const isSelect = /^\s*select/i.test(sqliteQuery);
          const bindParams = params || [];

          if (isSelect) {
            const rows = stmt.all(...bindParams);
            return {
              rows: rows,
              fields: [],
              affectedRows: 0,
            };
          } else {
            const info = stmt.run(...bindParams);
            return {
              rows: [],
              fields: [],
              affectedRows: info.changes,
            };
          }
        }

        const rows = await activeClient.unsafe(queryString, params || []);
        return {
          rows: Array.from(rows),
          fields: rows.columns || [],
          affectedRows: rows.count ?? 0,
        };
      };
    }
    const value = Reflect.get(activeClient, prop);
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});
export const getDb = () => db;
