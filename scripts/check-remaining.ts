import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const products = await sql`SELECT id, name, media FROM "Product"`;
    let badCount = 0;
    for (const p of products) {
       const mString = JSON.stringify(p.media || "");
       if (mString.includes("http")) {
           console.log(`Bad URL found in ${p.name}: ${mString}`);
           badCount++;
       }
    }
    console.log(`Total bad images: ${badCount}`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
