import { db } from "./src/infra/database/db-pool";
import { user } from "./src/infra/database/schema";
import { eq } from "drizzle-orm";

async function fixUsers() {
  const users = await db.select().from(user);
  let count = 0;
  for (const u of users) {
    const profile = u.profile as any;
    let changed = false;
    if (profile) {
      if (profile.avatar && profile.avatar.link && profile.avatar.link.includes("http")) {
        profile.avatar.link = "/images/default-avatar.avif";
        changed = true;
      }
      if (profile.cover && profile.cover.link && profile.cover.link.includes("http")) {
        profile.cover.link = "/images/default-avatar.avif";
        changed = true;
      }
    }
    if (changed) {
      await db.update(user).set({ profile }).where(eq(user.id, u.id));
      count++;
    }
  }
  console.log(`Updated ${count} users.`);
  process.exit(0);
}
fixUsers();
