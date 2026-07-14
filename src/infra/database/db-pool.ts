import { Secure } from "~/shared/utils/rng";
import "dotenv/config";
import * as schema from "./schema";
import nativeProcess from "node:process";
import { dbContext } from "./als";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Use the native node:process module object to persist the database client across all Vite HMR/ModuleRunner sandboxes
const globalForDb = nativeProcess as any;

if (!globalForDb._isolateId) {
  globalForDb._isolateId = Secure.uuid().split("-")[0];
  console.log(`[DB INIT] 🚨 NEW ISOLATE DETECTED: ${globalForDb._isolateId}`);
}

function initDb() {
  if (globalForDb.pgDb) {
    return { client: globalForDb.pgClient, db: globalForDb.pgDb };
  }

  console.log(`[DB INIT] 🔌 Connecting to PostgreSQL...`);

  let queryClient: any;
  let dbInstance: any;

  try {
    const postgresPackage = "postgres";
    const drizzlePackage = "drizzle-orm/postgres-js";
    const postgresModule = require(postgresPackage);
    const postgres = postgresModule.default || postgresModule;
    const { drizzle } = require(drizzlePackage);

    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/rottra";
    queryClient = globalForDb.pgClient ?? postgres(connectionString, { max: 10 });
    dbInstance = drizzle(queryClient, { schema });
  } catch (e) {
    console.error("Failed to connect to PostgreSQL:", e);
    queryClient = {};
    dbInstance = {
      execute: async () => [],
    };
  }

  globalForDb.pgClient = queryClient;
  globalForDb.pgDb = dbInstance;

  return { client: queryClient, db: dbInstance };
}

export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const { db: activeDb } = initDb();

    // Bỏ qua interception của execute, để Drizzle tự xử lý cho Postgres
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

    // Đối với postgres-js, `activeClient` có thể gọi được luôn thông qua tagged template
    if (prop === "query") {
      return async (queryString: string, params?: any[]) => {
        try {
          // postgres-js dùng .unsafe cho string query bình thường
          let rows: any[] = [];
          if (params && params.length > 0) {
            rows = await activeClient.unsafe(queryString, params);
          } else {
            rows = await activeClient.unsafe(queryString);
          }
          return {
            rows: rows,
            fields: rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ name: k })) : [],
            affectedRows: (rows as any).count ?? 0,
          };
        } catch (err) {
          console.error(`[Local PostgreSQL query error] query: ${queryString}, error:`, err);
          throw err;
        }
      };
    }
    const value = Reflect.get(activeClient, prop);
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});

export const getDb = () => db;
