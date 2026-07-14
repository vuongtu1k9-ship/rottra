import { createLogger } from "~/shared/logger";
import { db } from "~/infra/database/db-pool";
import { sql } from "drizzle-orm";

const log = createLogger("helpers/get-users");

async function main() {
  log.info("=== THÔNG TIN USER TRONG DATABASE ===");
  const users = await db.execute(sql`SELECT id, name, email, role FROM "user"`);
  log.info(JSON.stringify(users.rows, null, 2));
}

main().catch(console.error);
