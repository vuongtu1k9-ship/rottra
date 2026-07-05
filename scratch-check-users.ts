import { db } from "./src/infra/database/db-pool";
import { user } from "./src/infra/database/schema";

async function check() {
  const users = await db.select().from(user);
  const badUsers = users.filter(u => u.image && u.image.includes("http"));
  console.log("Users with http image:", badUsers.map(u => ({ id: u.id, name: u.name, image: u.image })));
  process.exit(0);
}
check();
