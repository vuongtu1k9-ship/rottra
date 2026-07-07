import "dotenv/config";
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

  console.log(`[DB INIT] 🔌 Connecting to SQLite (rottra.db)...`);
  
  let queryClient: any;
  let dbInstance: any;

  if (typeof process !== "undefined" && process.versions && process.versions.bun) {
    const bunSqlite = "bun:sqlite";
    const bunDrizzle = "drizzle-orm/bun-sqlite";
    const { Database } = require(bunSqlite);
    const { drizzle } = require(bunDrizzle);
    queryClient = globalForDb.pgClient ?? new Database("rottra.db");
    dbInstance = drizzle(queryClient, { schema });
  } else {
    try {
      const betterSqlite = "better-sqlite3";
      const betterDrizzle = "drizzle-orm/better-sqlite3";
      const Database = require(betterSqlite);
      const { drizzle } = require(betterDrizzle);
      queryClient = globalForDb.pgClient ?? new Database("rottra.db");
      dbInstance = drizzle(queryClient, { schema });
    } catch (e) {
      console.warn("better-sqlite3 not found, using memory database mock for Node.js");
      queryClient = {};
      dbInstance = {
        execute: async () => [],
      };
    }
  }

  globalForDb.pgClient = queryClient;
  globalForDb.pgDb = dbInstance;

  return { client: queryClient, db: dbInstance };
}

export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const d1Binding = dbContext.getStore();
    if (d1Binding) {
      const d1Db = drizzleD1(d1Binding, { schema });
      if (prop === "execute") {
        return async (...args: any[]) => {
          return Reflect.apply((d1Db as any).run, d1Db, args);
        }
      }
      const value = Reflect.get(d1Db, prop);
      return typeof value === "function" ? value.bind(d1Db) : value;
    }

    const { db: activeDb } = initDb();
    if (prop === "execute") {
      return async (...args: any[]) => {
        const result = await activeDb.all(...args);
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
    const d1Binding = dbContext.getStore();
    if (d1Binding) {
      throw new Error("pgClient cannot be invoked as a function in Cloudflare Pages/D1 environment.");
    }
    const { client: activeClient } = initDb();
    return (activeClient as any)(...argumentsList);
  },
  get(target, prop, receiver) {
    const d1Binding = dbContext.getStore();
    if (d1Binding) {
      if (prop === "query") {
        return async (queryString: string, params?: any[]) => {
          let sqliteQuery = queryString.replace(/\$\d+/g, "?");
          try {
            const stmt = d1Binding.prepare(sqliteQuery);
            const res = params && params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
            const rows = res.results || [];
            return {
              rows: rows,
              fields: rows.length > 0 ? Object.keys(rows[0]).map(k => ({ name: k })) : [],
              affectedRows: res.meta?.changes ?? 0,
            };
          } catch (err: any) {
            console.error(`[D1 RAW QUERY ERROR] query: ${queryString}, error:`, err);
            throw err;
          }
        };
      }
    }

    const { client: activeClient } = initDb();
    if (prop === "query") {
      return async (queryString: string, params?: any[]) => {
        let sqliteQuery = queryString.replace(/\$\d+/g, "?");
        try {
          let rows: any[] = [];
          if (typeof activeClient.query === "function") {
            const stmt = activeClient.query(sqliteQuery);
            rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
          } else if (typeof activeClient.prepare === "function") {
            const stmt = activeClient.prepare(sqliteQuery);
            rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
          } else {
            console.warn("No valid SQLite client found for raw query execution.");
          }
          return {
            rows: rows,
            fields: rows.length > 0 ? Object.keys(rows[0]).map(k => ({ name: k })) : [],
            affectedRows: 0,
          };
        } catch (err) {
          console.error(`[Local SQLite query error] query: ${queryString}, error:`, err);
          throw err;
        }
      };
    }
    const value = Reflect.get(activeClient, prop);
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});

export const getDb = () => db;
