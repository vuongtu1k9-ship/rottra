import { db } from "./src/infra/database/db-pool.js";

async function queryUsers() {
  const users = await db.query.user.findMany();
  for (const u of users) {
    if (u.id.includes("Luong") || u.id.includes("luong") || u.id.includes("Nguyet") || u.role === "agent") {
      console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role}`);
    }
  }
  process.exit(0);
}

queryUsers();
