import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const agents = await sql`SELECT id, name, image, role FROM "user" WHERE role = 'agent'`;
    console.log(JSON.stringify(agents, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
