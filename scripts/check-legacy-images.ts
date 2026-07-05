import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const products = await sql`SELECT id, name, "imageUrl", img FROM "Product" WHERE "imageUrl" IS NOT NULL OR img IS NOT NULL LIMIT 20`;
    console.log("Products with legacy images:", products.length);
    for (const p of products) {
       console.log(`ID: ${p.id}, imageUrl: ${p.imageUrl}, img: ${JSON.stringify(p.img)}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
