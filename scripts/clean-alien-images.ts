import { db } from "../src/infra/database/db-pool";
import { product } from "../src/infra/database/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("🕵️ Searching for alien images in products...");
  const allProducts = await db.query.product.findMany();
  let fixedCount = 0;

  for (const p of allProducts) {
    if (p.media && Array.isArray(p.media)) {
      let hasAlien = false;
      const cleanMedia = p.media.filter((m: any) => {
        const link = typeof m === "string" ? m : m.link;
        if (!link) return false;
        
        // Cờ hiệu ảnh ngoại lai
        const isAlien = 
          link.includes("canva.com") || 
          link.includes("Kapitan") ||
          link.includes("Korean") ||
          link.includes("Components") ||
          link.includes("Scania") ||
          (link.startsWith("http") && !link.includes("rottra")); // Lọc gắt các link ngoài

        if (isAlien) {
          console.log(`❌ Phóng lợn ảnh ngoại lai khỏi [${p.name}]: ${link}`);
          hasAlien = true;
          return false;
        }
        return true;
      });

      if (hasAlien) {
        console.log(`✅ Đang fix sản phẩm: ${p.name}`);
        // Nếu xóa hết ảnh ngoại lai mà mảng rỗng, cho nó 1 cái ảnh mặc định
        if (cleanMedia.length === 0) {
          cleanMedia.push({ type: "image", link: "/images/no-image.avif" });
        }
        await db.update(product).set({ media: cleanMedia }).where(eq(product.id, p.id));
        fixedCount++;
      }
    }
  }

  console.log(`\n🎉 Done! Đã tiêu diệt ảnh ngoại lai trên ${fixedCount} sản phẩm.`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
