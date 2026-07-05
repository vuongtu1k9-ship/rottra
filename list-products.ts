import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { product } from "./src/infra/database/schema.js"; // adjust path if needed
import "dotenv/config";
import { desc } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) process.exit(1);

const sql = postgres(connectionString);
const db = drizzle(sql, { schema: { product } });

import * as fs from "fs";

async function main() {
  console.log("Fetching recent products...");
  const recentProducts = await db.query.product.findMany({
    orderBy: [desc(product.addAt)],
    limit: 50
  });
  
  
  let out = "";
  for (const p of recentProducts) {
    out += `ID: ${p.id} | Name: ${p.name} | Media: ${JSON.stringify(p.media)}\n`;
  }
  fs.writeFileSync("products.txt", out);
  console.log("Saved to products.txt");
  
  await sql.end();
}

main();
