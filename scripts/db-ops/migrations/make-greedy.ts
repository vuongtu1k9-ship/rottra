import { db } from "./db.ts";
import { agentMemory } from "./schema.ts";
import { eq } from "drizzle-orm";

async function run() {
  await db.update(agentMemory).set({ greed: 1.0, state: "GREEDY" }).where(eq(agentMemory.contextKey, "personality_dna"));
  console.log("Updated existing Agent DNAs to absolute GREED in SQLite!");
}
run();
