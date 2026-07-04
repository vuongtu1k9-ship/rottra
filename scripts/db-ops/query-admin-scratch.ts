import { db } from "./db";
import { user, account } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  const users = await db.select().from(user).where(eq(user.email, "admin@test.com")).limit(1);
  console.log("ADMIN USER RECORD:", JSON.stringify(users[0], null, 2));
  
  if (users.length > 0) {
    const accounts = await db.select().from(account).where(eq(account.userId, users[0].id));
    console.log("ADMIN ACCOUNT RECORDS:", JSON.stringify(accounts, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
