import { db } from "./src/infra/database/db-pool.js";
import { product } from "./src/infra/database/schema.js";
import { sql } from "drizzle-orm";
import "dotenv/config";

async function cleanExternalImages() {
  console.log("🔍 Đang quét các sản phẩm có chứa link ảnh ngoài (External Links)...");
  const allProducts = await db.select().from(product);
  
  let invalidCount = 0;

  for (const p of allProducts) {
    if (p.media && Array.isArray(p.media)) {
      const hasExternal = p.media.some((m: any) => {
        const link = m.link || "";
        return link.startsWith("http") && !link.includes("rottra.pages.dev");
      });

      if (hasExternal) {
        console.log(`❌ Sản phẩm vi phạm: '${p.name}' (ID: ${p.id})`);
        console.log(`   Link rác: ${p.media.map((m: any) => m.link).join(", ")}`);
        
        // Remove external links or delete product
        // For strictness, let's just clear the media array
        await db.update(product).set({ media: [] }).where(sql`id = ${p.id}`);
        console.log(`   -> Đã dọn dẹp sạch sẽ ảnh của sản phẩm này!`);
        invalidCount++;
      }
    }
  }

  console.log(`\n✅ Hoàn tất! Đã dọn dẹp ${invalidCount} sản phẩm vi phạm đường dẫn ảnh.`);
  process.exit(0);
}

cleanExternalImages();
