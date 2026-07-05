import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { like, ne, and } from "drizzle-orm";
import { user } from "./src/infra/database/schema.js";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) process.exit(1);

const sql = postgres(connectionString);
const db = drizzle(sql, { schema: { user } });

async function main() {
  console.log("Nullifying agent avatars...");
  await db.update(user)
    .set({ image: null })
    .where(and(like(user.email, "%@rottra.com"), ne(user.email, "admin@rottra.com")));
  
  console.log("Agent avatars reset to text/initials!");
  await sql.end();
}

main();
