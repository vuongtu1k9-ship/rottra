import fs from "fs";
import postgres from "postgres";

const sql = postgres("postgresql://postgres:1234@localhost:5432/rottra");
const query = fs.readFileSync("drizzle/0000_married_mathemanic.sql", "utf-8");

async function run() {
  try {
    console.log("Dropping public schema...");
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Running migration...");
    await sql.unsafe(query);
    console.log("Done");
  } catch (e) {
    console.error("Migration error:", e);
  } finally {
    await sql.end();
  }
}
run();
