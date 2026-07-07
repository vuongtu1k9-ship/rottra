import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
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
  if (globalForDb.pgDb) {
    return { client: globalForDb.pgClient, db: globalForDb.pgDb };
  }

  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/rottra";
  console.log(`[DB INIT] 🔌 Connecting to PostgreSQL...`);

  const queryClient =
    globalForDb.pgClient ??
    postgres(connectionString, {
      max: 2,
      idle_timeout: 3,
      connect_timeout: 10,
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

    const { db: activeDb } = initDb();
    if (prop === "execute") {
      return async (...args: any[]) => {
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
    return (activeClient as any)(...argumentsList);
  },
  get(target, prop, receiver) {
    const { client: activeClient } = initDb();
    if (prop === "query") {
      return async (queryString: string, params?: any[]) => {
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
