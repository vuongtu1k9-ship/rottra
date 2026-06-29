import { db } from "./src/infra/database/db-pool";
import { agentMemory, user } from "./src/infra/database/schema";

async function main() {
  const memories = await db.select().from(agentMemory);
  console.log("=== Agent Memory Count ===", memories.length);
  console.log("=== Agent Memory DNA Entries ===");
  console.log(memories.filter(m => m.contextKey === "personality_dna").map(m => ({
    sessionId: m.sessionId,
    contextKey: m.contextKey,
    greed: m.greed,
    vengeance: m.vengeance,
    malice: m.malice,
    state: m.state
  })));

  const users = await db.select().from(user);
  console.log("=== User Entries (ID, username, role) ===");
  console.log(users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name })));
}

main().catch(console.error).finally(() => process.exit(0));
