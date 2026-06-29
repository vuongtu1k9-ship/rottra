import { db } from "../../src/infra/database/db-pool";
import { user } from "../../src/infra/database/schema";
import { eq } from "drizzle-orm";
import { serverAgentBudgets } from "../../src/shared/constants";

const defaultEmployees: Record<string, number> = {
  toLuong: 25,
  thuongNguyet: 18,
  tramTinh: 12,
  daoTieuCuu: 8,
  hoaHuynh: 15,
  phiNguyet: 10,
  nhuNguyet: 9,
  suGia: 7,
  phiAnh: 14,
  bachDiHanh: 11,
  uVuongMau: 16,
  bachLoc: 5,
};

async function run() {
  const allUsers = await db.query.user.findMany();
  const agentIds = Object.keys(defaultEmployees);

  for (const u of allUsers) {
    const key = u.id.replace(/^user_?/, "");
    if (agentIds.includes(key)) {
      const p = { ...(u.profile as any) || {} };
      
      // Fix employees: if it is currently 5 or undefined, set to the correct default
      const currentEmployees = p.employees;
      const targetEmployees = defaultEmployees[key];
      if (currentEmployees === undefined || currentEmployees === 5 || currentEmployees === 0) {
        p.employees = targetEmployees;
        console.log(`Updating ${u.id} employees count: ${currentEmployees} -> ${targetEmployees}`);
      }

      // Fix gold: if it is 10 or undefined, set to 0. Otherwise keep current traded gold value.
      const currentGold = p.gold;
      if (currentGold === undefined || currentGold === 10) {
        p.gold = 0;
        console.log(`Updating ${u.id} gold: ${currentGold} -> 0`);
      }

      // Ensure budget is set to default if undefined
      if (p.budget === undefined) {
        p.budget = serverAgentBudgets[key] || 0;
      }

      await db.update(user).set({ profile: p }).where(eq(user.id, u.id));
    }
  }

  console.log("Database agent profiles correction complete!");
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
