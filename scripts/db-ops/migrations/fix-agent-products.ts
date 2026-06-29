import { db } from "./db";
import { product, user, agentMemory } from "./schema";
import { eq, inArray, and } from "drizzle-orm";

async function main() {
  console.log("🧹 Đang dọn dẹp kho hàng của các Agent...");

  const agents = await db.query.user.findMany({
    where: eq(user.role, "user"),
  });

  const dnas = await db.query.agentMemory.findMany({
    where: eq(agentMemory.contextKey, "personality_dna"),
  });
  const dnaMap = new Map();
  for (const d of dnas) dnaMap.set(d.sessionId, d);

  const agentIds = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];

  let totalReassigned = 0;

  for (const agentId of agentIds) {
    const dna = dnaMap.get(agentId) || {};
    let precision = 3;
    const greed = dna.greed ?? 0.5;
    const malice = dna.malice ?? 0.5;
    if (greed > 0.7 || malice > 0.7) precision = 5;
    else if (greed < 0.4) precision = 2;

    const agentProds = await db.query.product.findMany({
      where: eq(product.sellerId, agentId),
    });

    if (agentProds.length > precision) {
      // Giữ lại đúng `precision` sản phẩm
      const toKeep = agentProds.slice(0, precision).map((p) => p.id);
      const toReassign = agentProds.filter((p) => !toKeep.includes(p.id)).map((p) => p.id);

      if (toReassign.length > 0) {
        // Đưa các sản phẩm còn lại về system_agent_user (Trợ Lý Cao Cấp Rottra)
        for (let i = 0; i < toReassign.length; i += 100) {
          const batch = toReassign.slice(i, i + 100);
          await db.update(product).set({ sellerId: "system_agent_user" }).where(inArray(product.id, batch));
        }
        totalReassigned += toReassign.length;
        console.log(`Agent ${agentId} (Độ kỹ ${precision}): Đã giữ lại ${precision} sản phẩm, thu hồi ${toReassign.length} sản phẩm về kho tổng.`);
      }
    }
  }

  console.log(`✅ Hoàn tất! Đã thu hồi tổng cộng ${totalReassigned} sản phẩm về kho tổng (system_agent_user).`);
  process.exit(0);
}

main();
