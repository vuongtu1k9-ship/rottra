import { db } from "../src/infra/database/db-pool";
import { sql } from "drizzle-orm";

async function findAlienImage() {
  console.log("Đang quét toàn bộ DB để tìm ảnh vectorstock...");
  try {
    // Check products media
    const p1 = await db.execute(sql`SELECT id, name, media FROM "Product" WHERE media::text LIKE '%vectorstock%'`);
    if (p1.length > 0) console.log("Found in Product media:", p1);

    // Check products description
    const p2 = await db.execute(sql`SELECT id, name, description FROM "Product" WHERE description LIKE '%vectorstock%'`);
    if (p2.length > 0) console.log("Found in Product description:", p2);

    // Check Users
    const u = await db.execute(sql`SELECT id, "fullName", avatar FROM "users" WHERE avatar LIKE '%vectorstock%'`);
    if (u.length > 0) console.log("Found in Users avatar:", u);

    // Check ChatHistory
    const c = await db.execute(sql`SELECT id, message FROM "ChatHistory" WHERE message LIKE '%vectorstock%'`);
    if (c.length > 0) console.log("Found in ChatHistory message:", c);

    console.log("Quét hoàn tất!");
  } catch (e) {
    console.error("Lỗi:", e);
  }
  process.exit(0);
}

findAlienImage();
