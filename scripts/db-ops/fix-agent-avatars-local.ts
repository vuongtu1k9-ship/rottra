import { Deterministic } from "~/shared/utils/rng";
import { db } from "../../src/infra/database/db-pool";
import { user } from "../../src/infra/database/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith("ai_auto_") && f.endsWith(".png"));
  
  // Shuffle
  for (let i = files.length - 1; i > 0; i--) {
    const j = Math.floor(Deterministic.random() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }
  
  const agents = await db.select().from(user);
  let agentCount = 0;
  for (const a of agents) {
    if (a.name === "Admin User" || a.name === "Uset") continue;
    
    // Only update if they currently have an emoji or letter as an image
    // (if it's length <= 2 or doesn't start with /)
    if (!a.image || a.image.length <= 4 || !a.image.startsWith("/")) {
      const uniqueAvatar = "/uploads/" + files.pop();
      await db.update(user)
        .set({ image: uniqueAvatar })
        .where(eq(user.id, a.id));
      agentCount++;
    }
  }
  
  console.log(`Updated ${agentCount} agents with unique AI avatars.`);
  process.exit(0);
}

main();
