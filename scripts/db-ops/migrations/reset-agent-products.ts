import { db } from "./db";
import { product, review, cart, orderItem } from "./schema";
import { inArray } from "drizzle-orm";

async function main() {
  console.log("🧹 Xóa toàn bộ sản phẩm của các Agent để làm lại từ đầu...");

  const agentIds = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];

  const agentProds = await db.query.product.findMany({
    where: inArray(product.sellerId, agentIds),
  });

  const prodIds = agentProds.map((p) => p.id);

  if (prodIds.length > 0) {
    // Xóa dữ liệu liên quan trước (để tránh lỗi khóa ngoại nếu có)
    for (let j = 0; j < prodIds.length; j += 100) {
      const batch = prodIds.slice(j, j + 100);
      await db.delete(review).where(inArray(review.productId, batch));
      await db.delete(cart).where(inArray(cart.productId, batch));
      await db.delete(orderItem).where(inArray(orderItem.productId, batch));
      await db.delete(product).where(inArray(product.id, batch));
    }
  }

  console.log(`✅ Đã xóa sạch ${prodIds.length} sản phẩm của 12 Agents! Các Agents hiện đang có 0 sản phẩm.`);
  process.exit(0);
}

main();
