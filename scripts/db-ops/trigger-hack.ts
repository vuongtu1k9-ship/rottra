import { db } from "~/infra/database/db-pool";
import { user, product, activity } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

async function triggerHack() {
  console.log("💣 KHỞI ĐỘNG CHIẾN DỊCH HACK...");
  const users = await db.select().from(user);
  
  // Find Red Team (Nguyệt)
  const attackers = users.filter((u: any) => {
    const faction = (u.profile as any)?.faction || "";
    return faction.includes("Nguyệt") || (u.name || u.username).includes("Nguyệt");
  });
  
  // Find Blue Team (Quang)
  const defenders = users.filter((u: any) => {
    const faction = (u.profile as any)?.faction || "";
    return faction.includes("Quang Minh") || (u.name || u.username).includes("Anh") || (u.name || u.username).includes("Quang");
  });

  if (attackers.length === 0 || defenders.length === 0) {
    console.log("❌ Không tìm thấy phe Nguyệt hoặc Quang trong DB!");
    process.exit(1);
  }

  const attacker = attackers[0];
  const victim = defenders[0];

  console.log(`🗡️ Kẻ tấn công (Red Team): ${attacker.name || attacker.username}`);
  console.log(`🛡️ Nạn nhân (Blue Team): ${victim.name || victim.username}`);

  // Tấn công Web: Tìm sản phẩm của nạn nhân và phá giá!
  const allProducts = await db.select().from(product);
  const victimProds = allProducts.filter((p: any) => p.sellerId === victim.id);
  
  if (victimProds.length === 0) {
     console.log("❌ Nạn nhân không có sản phẩm nào để hack!");
     process.exit(1);
  }

  const targetProd = victimProds[0];
  const newName = `[HACKED BY ${attacker.name || attacker.username}] ${targetProd.name}`;
  
  console.log(`💀 Đang tiến hành DEFACE sản phẩm: ${targetProd.name}`);
  
  await db.update(product)
    .set({ 
      name: newName,
      price: 1 
    })
    .where(eq(product.id, targetProd.id));

  const defaceMsg = ` \\n🏴‍☠️ [DATABASE BỊ XUYÊN THỦNG] Sản phẩm "${targetProd.name}" của nạn nhân đã bị đổi tên thành "${newName}" và reset giá về 1₫! Ai nhanh tay vào mua ngay!!`;
  
  const sabotageMsg = `🕵️‍♂️ Ta đã tấn công DDoS vào cổng thanh toán của website ${victim.name || victim.username}, rút ruột 10,000,000đ!${defaceMsg}`;
  
  await db.insert(activity).values({
      id: crypto.randomUUID(),
      userId: attacker.id,
      action: "SABOTAGE_STEAL",
      message: sabotageMsg,
      level: "warn",
      metadata: { victimId: victim.id, stealAmt: 10000000, isTest: true },
  });

  console.log("✅ HACK THÀNH CÔNG! Hãy kiểm tra trên web UI!");
  process.exit(0);
}

triggerHack().catch(console.error);
