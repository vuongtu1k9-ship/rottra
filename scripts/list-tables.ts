import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const tables = await sql`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
    `;
    console.log("Tables:", tables.map(t => t.tablename));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
