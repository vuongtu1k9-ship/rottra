import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "~/infra/database/db-pool";
import * as schema from "~/infra/database/schema";
import crypto from "node:crypto";

if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "some-secure-default-secret-key-1234567890-rottra-app-fallback-secret-5719";
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "some-secure-default-secret-key-1234567890-rottra-app",
  trustHeaders: true,
  trustedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.1.63:5173",
    "http://192.168.1.145:5173",
    "https://rottra.pages.dev",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  session: {
    strategy: "jwt",
  } as any,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          try {
            await db.insert(schema.activity).values({
              id: crypto.randomUUID(),
              userId: newUser.id,
              action: "Đăng ký tài khoản mới",
              message: `Tài khoản ${newUser.email} đã đăng ký thành công`,
              level: "user",
              device: "Không xác định",
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            console.error("Failed to log signup activity:", err);
          }
        },
      },
    },
  },
});
