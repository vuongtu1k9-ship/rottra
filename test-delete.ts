import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { product } from "./src/infra/database/schema.js"; // adjust path if needed
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function main() {
  const productId = "28b3cd49-4c8a-4dbb-80f4-34bcc95c013f";
  console.log(`Bắt đầu thử xóa sản phẩm ${productId}...`);
  try {
    const result = await db.delete(product).where(eq(product.id, productId));
    console.log("Xóa thành công!", result);
  } catch (e: any) {
    console.error("LỖI DATABASE KHI XÓA:", e);
  } finally {
    await sql.end();
  }
}

main();
