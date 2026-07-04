import { db } from "./src/infra/database/db-pool";
import { user } from "./src/infra/database/schema";
import { eq } from "drizzle-orm";

async function test() {
  try {
    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, "RottraAI"),
    });
    console.log("Success! Found user:", dbUser?.name);
  } catch (e) {
    console.error("Database connection failed:", e);
  }
  process.exit(0);
}
test();
