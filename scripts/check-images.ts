import { db } from "../src/infra/database/db-pool";
import { product } from "../src/infra/database/schema";

async function checkDB() {
  console.log("Đang kiểm tra Database...");
  try {
    const products = await db.query.product.findMany({
      limit: 15
    });

    console.log(`Tìm thấy ${products.length} sản phẩm:`);
    products.forEach(p => {
      const media = (p.media as any[]) || [];
      const link = media[0]?.link || "Không có ảnh";
      let shortLink = link;
      if (shortLink.length > 80) {
        shortLink = shortLink.substring(0, 40) + " ... [BỊ CẮT GỌN] ... " + shortLink.substring(shortLink.length - 20);
      }
      console.log(`- Tên: ${p.name}`);
      console.log(`  Ảnh: ${shortLink}`);
    });
  } catch (e) {
    console.error("Lỗi:", e);
  }
  process.exit(0);
}

checkDB();
