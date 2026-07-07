import { AsyncLocalStorage } from "node:async_hooks";

// This stores the D1 database binding per-request for Cloudflare Workers
export const dbContext = new AsyncLocalStorage<any>();
