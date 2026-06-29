import { db } from "~/infra/database/db-pool";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== THÔNG TIN USER TRONG DATABASE ===");
  const users = await db.execute(sql`SELECT id, name, email, role FROM "user"`);
  console.log(JSON.stringify(users.rows, null, 2));
}

main().catch(console.error);
