import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const products = await sql`SELECT id, name, media FROM "Product" LIMIT 20`;
    console.log("Products:");
    for (const p of products) {
       console.log(`ID: ${p.id}, Name: ${p.name}`);
       if (p.media && p.media.length > 0) {
           console.log(`  Media: ${JSON.stringify(p.media[0]).substring(0, 100)}...`);
       }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
