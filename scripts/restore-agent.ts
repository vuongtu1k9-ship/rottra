import { db } from "../src/infra/database/db-pool";
import * as schema from "../src/infra/database/schema";

async function run() {
  console.log("Restoring RottraAI...");
  await db.insert(schema.user).values({
    id: "RottraAI",
    email: "agent@rottra.com",
    name: "Lõi Agent Tối Cao",
    role: "agent",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();
  console.log("RottraAI restored.");
  process.exit(0);
}

run().catch(console.error);
