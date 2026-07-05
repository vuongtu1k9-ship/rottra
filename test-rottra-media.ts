import { db } from "./src/infra/database/db-pool.js";
import { product } from "./src/infra/database/schema.js";
import { eq } from "drizzle-orm";
import { GenerateImageAction } from "./src/core/cognitive-swarm/bot-actions.js";
import "dotenv/config";

async function testRottraAIGeneration() {
  console.log("🚀 Đang khởi động Rottra AI Media Generator...");
  
  // Lấy một user làm mẫu (vd: toLuong hoặc admin)
  const p = await db.query.product.findFirst();
  if (!p) {
    console.log("Không có sản phẩm nào để test.");
    process.exit(1);
  }

  console.log(`Tiến hành tạo banner Media cho sản phẩm: ${p.name}`);

  const action = new GenerateImageAction();
  
  // Mock helpers
  const mockHelpers = {
    getProductImageUrl: (media: any[], style: string) => {
      if (!media || media.length === 0) return null;
      return "file://" + process.cwd() + "/public" + media[0].link;
    },
    logActivity: async () => { console.log("Mock logActivity called"); }
  };

  const result = await action.execute(p.sellerId, "agent-1", mockHelpers as any);
  
  console.log("✅ Rottra AI đã trả về kết quả:", result);
  process.exit(0);
}

testRottraAIGeneration();
