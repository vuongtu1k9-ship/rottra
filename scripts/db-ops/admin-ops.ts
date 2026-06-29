import { auth } from "../../src/server/auth";
import { db } from "./db";
import { user } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Starting admin user creation...");
  try {
    const newUser = await auth.api.signUpEmail({
      body: {
        email: "admin@test.com",
        password: "password",
        name: "Admin Test",
      },
    });
    console.log("✅ User created successfully via Better Auth:", newUser);
  } catch (error: any) {
    console.error("❌ Better Auth sign up failed:", error.message || error);
  }

  // Update role to admin
  const res = await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@test.com")).returning();
  if (res.length > 0) {
    console.log("✅ Successfully promoted admin@test.com to admin!", res[0]);
  } else {
    console.log("❌ Could not promote admin@test.com. Maybe user wasn't created.");
  }

  process.exit(0);
}

main().catch(console.error);
