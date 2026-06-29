import { db } from "./db";
import { user } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== ĐANG NÂNG CẤP TÀI KHOẢN admin@Rottra.com THÀNH ADMIN ===");
  const res = await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@Rottra.com")).returning();

  if (res.length > 0) {
    console.log("✅ Đã nâng cấp thành công!", res[0]);
  } else {
    console.log("❌ Không tìm thấy user với email admin@Rottra.com. Hãy đăng ký tài khoản này trước!");
  }
}

main().catch(console.error);
