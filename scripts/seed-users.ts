import { db } from "../src/infra/database/db-pool";
import * as schema from "../src/infra/database/schema";
import { auth } from "../src/server/auth";

async function run() {
  console.log("🧹 Xóa toàn bộ dữ liệu User cũ...");
  await db.delete(schema.session);
  await db.delete(schema.account);
  await db.delete(schema.user);

  console.log("🌱 Đang tạo tài khoản admin@test.com (mk: password)...");
  await auth.api.signUpEmail({
    body: {
      email: "admin@test.com",
      password: "password",
      name: "Admin Tester",
    },
    asResponse: false
  } as any);

  console.log("🌱 Đang tạo tài khoản user@test.com (mk: password)...");
  await auth.api.signUpEmail({
    body: {
      email: "user@test.com",
      password: "password",
      name: "User Tester",
    },
    asResponse: false
  } as any);

  // Set quyền admin
  console.log("👑 Cấp quyền admin cho admin@test.com...");
  const { eq } = await import("drizzle-orm");
  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.email, "admin@test.com"));

  console.log("✅ Hoàn tất! Hệ thống giờ chỉ có 2 tài khoản duy nhất.");
  process.exit(0);
}

run().catch(console.error);
