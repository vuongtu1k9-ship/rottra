import { db } from "./src/infra/database/db-pool.js";
import { product } from "./src/infra/database/schema.js";
import { eq } from "drizzle-orm";
import "dotenv/config";

async function main() {
  const id = "prod_toLuong_1783179243192_964";
  try {
    await db.delete(product).where(eq(product.id, id));
    console.log("Deleted!");
  } catch (e: any) {
    console.error("Delete failed:", e);
  }
  process.exit(0);
}
main();
