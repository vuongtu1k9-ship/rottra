import { db } from "../../src/infra/database/db-pool";
import { user } from "../../src/infra/database/schema";
import { eq } from "drizzle-orm";
import { generateAgentImage } from "../../src/server/api/creative-engine";

async function main() {
  const agents = await db.select().from(user);
  console.log(`Found ${agents.length} users. Generating avatars for agents...`);
  
  for (const a of agents) {
    if (a.role !== "system" && a.role !== "admin") continue;

    console.log(`Generating avatar for agent: ${a.name}...`);
    const prompt = `portrait of ${a.name}, highly detailed face, professional, cinematic lighting, anime style or realism`;
    const res = await generateAgentImage(a.id, prompt, { width: 512, height: 512 });
    
    if (res.success && res.url) {
      console.log(`-> Success: ${res.url}`);
      await db.update(user)
        .set({ image: res.url })
        .where(eq(user.id, a.id));
    } else {
      console.log(`-> Failed for ${a.name}: ${res.error}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log("Done updating agents with AI avatars.");
  process.exit(0);
}

main();
