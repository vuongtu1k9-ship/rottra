import { db } from "./src/infra/database/db-pool.js";
import { product } from "./src/infra/database/schema.js";
import { GenerateImageAction } from "./src/core/cognitive-swarm/bot-actions.js";
import { eq } from "drizzle-orm";
import "dotenv/config";

const AGENT_LIST = [
  "toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", 
  "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", 
  "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"
];

async function check12AgentsOutput() {
  console.log("🚀 Đang khởi động quá trình kiểm tra sản phẩm đầu ra của 12 Agent...\n");
  
  const action = new GenerateImageAction();
  const mockHelpers = {
    getProductImageUrl: (media: any[], style: string) => {
      if (!media || media.length === 0) return null;
      return "file://" + process.cwd() + "/public" + media[0].link;
    },
    logActivity: async () => {} // Mock
  };

  for (const agentId of AGENT_LIST) {
    console.log(`🤖 Đang kiểm tra Agent: [${agentId}]...`);
    
    // Tìm sản phẩm của agent này (hoặc lấy đại 1 sản phẩm nếu agent chưa có)
    let p = await db.query.product.findFirst({ where: eq(product.sellerId, agentId) });
    if (!p) {
      console.log(`   ⚠️ Agent ${agentId} chưa có sản phẩm. Mượn tạm sản phẩm hệ thống để test.`);
      p = await db.query.product.findFirst();
    }

    if (!p) {
      console.log("   ❌ Hệ thống không có bất kỳ sản phẩm nào!");
      break;
    }

    console.log(`   📦 Đang sinh Media (AVIF + WebM AV1 Opus) cho sản phẩm: "${p.name}"`);
    try {
      const result = await action.execute(p.sellerId, agentId, mockHelpers as any);
      if (result.success) {
        console.log(`   ✅ Thành công! Link: ${result.imageUrl}`);
      } else {
        console.log(`   ❌ Thất bại: ${result.message}`);
      }
    } catch (err: any) {
      console.log(`   ❌ Lỗi hệ thống: ${err.message}`);
    }
    console.log("---------------------------------------------------");
  }

  console.log("\n🎉 HOÀN TẤT KIỂM TRA ĐẦU RA CỦA 12 AGENT!");
  process.exit(0);
}

check12AgentsOutput();
