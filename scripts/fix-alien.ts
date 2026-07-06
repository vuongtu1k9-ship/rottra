import { db } from "../src/infra/database/db-pool";
import { product } from "../src/infra/database/schema";
import { eq } from "drizzle-orm";

async function fix() {
  await db.update(product).set({ media: null }).where(eq(product.id, "fec589f2-93ee-4f1b-99d2-a1c3960920ba"));
  console.log("Đã diệt tận gốc ảnh vectorstock");
  process.exit(0);
}

fix();
