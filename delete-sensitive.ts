import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inArray } from "drizzle-orm";
import { product } from "./src/infra/database/schema.js"; // adjust path if needed
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) process.exit(1);

const sql = postgres(connectionString);
const db = drizzle(sql, { schema: { product } });

async function main() {
  const idsToDelete = [
    "afb74128-7082-4b7c-802d-c4cc1b41fc2f", // erodaizensyu
    "prod_suGia_1783176994665_2365",       // zol-img
    "603826a1-c8bf-4fe4-9939-d080045c36f1" // pinterest face
  ];
  
  console.log("Deleting sensitive products...");
  const res = await db.delete(product).where(inArray(product.id, idsToDelete));
  console.log("Deleted!", res);
  
  await sql.end();
}

main();
