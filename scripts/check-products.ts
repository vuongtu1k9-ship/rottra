import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const products = await sql`SELECT id, name, media FROM "Product"`;
    console.log(JSON.stringify(products, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
