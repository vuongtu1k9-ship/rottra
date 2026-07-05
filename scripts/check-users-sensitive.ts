import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const users = await sql`SELECT id, name, image FROM "user" LIMIT 20`;
    console.log("Users:");
    for (const u of users) {
       console.log(`ID: ${u.id}, Name: ${u.name}, Image: ${u.image}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
