import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) process.exit(1);

const sql = postgres(connectionString);
const db = drizzle(sql);

async function main() {
  console.log("Creating AiModels table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "AiModels" (
      "id" text PRIMARY KEY NOT NULL,
      "weightsJson" text NOT NULL,
      "lastUpdated" timestamp with time zone DEFAULT now()
    );
  `;
  console.log("Created successfully!");
  
  await sql.end();
}

main();
