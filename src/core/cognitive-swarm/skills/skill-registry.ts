import { db } from "~/infra/database/db-pool";
import { product } from "~/infra/database/schema";
import { or, sql } from "drizzle-orm";

export interface AgentSkill {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string>;
}

export const skillRegistry: Record<string, AgentSkill> = {
  query_market_data: {
    name: "query_market_data",
    description: "Tìm kiếm thông tin giá cả, số lượng và chi tiết các mặt hàng trên thị trường.",
    parameters: {
      keyword: "string (Từ khóa mặt hàng cần tìm, ví dụ: 'Thanh Long')"
    },
    execute: async (args: any) => {
      if (!args.keyword) return "Lỗi: Thiếu tham số keyword.";
      const kw = args.keyword.toLowerCase();
      const words = kw.split(/\s+/).filter((w: string) => w.trim().length > 0);
      
      if (words.length === 0) return "Lỗi: Từ khóa không hợp lệ.";
      
      const conditions = words.map((w: string) => sql`LOWER(${product.name}) LIKE ${'%' + w + '%'}`);
      const items = await db.select().from(product).where(or(...conditions)).limit(5);
      
      if (items.length === 0) return `Không tìm thấy thông tin mặt hàng nào khớp với "${args.keyword}".`;
      
      let result = `Kết quả tra cứu thị trường cho "${args.keyword}":\n`;
      items.forEach(item => {
        result += `- Tên: ${item.name} | Giá bán hiện tại: ${item.price} VND | Giá gốc: ${item.costPrice} VND | Tồn kho: ${item.quantity}\n`;
      });
      return result;
    }
  },
  generate_chart: {
    name: "generate_chart",
    description: "Sinh ra mã JSON để vẽ biểu đồ (nếu người dùng yêu cầu xem dữ liệu trực quan).",
    parameters: {
      type: "string (Chỉ chọn: 'bar', 'line', 'pie')",
      title: "string (Tiêu đề biểu đồ)",
      labels: "array of string (Tên các cột/điểm)",
      data: "array of number (Dữ liệu tương ứng)"
    },
    execute: async (args: any) => {
      return `[CHỈ THỊ FRONTEND]: Hệ thống đã ghi nhận yêu cầu vẽ biểu đồ ${args.type} và sẽ hiển thị cho User.\n\n\`\`\`chart\n${JSON.stringify(args, null, 2)}\n\`\`\``;
    }
  }
};

export const getSkillManual = (): string => {
  let manual = "\n\n=== HỆ THỐNG KỸ NĂNG CỦA BẠN (TOOL-USE) ===\nBạn được trang bị các công cụ dưới đây để tương tác với thế giới thực. HÃY GỌI CHÚNG KHI BẠN THIẾU THÔNG TIN.\n";
  Object.values(skillRegistry).forEach(skill => {
    manual += `- Tool: "${skill.name}"\n  Mô tả: ${skill.description}\n  Tham số: ${JSON.stringify(skill.parameters)}\n`;
  });
  manual += `\n[HƯỚNG DẪN QUAN TRỌNG]: Nếu bạn muốn gọi Tool, bạn KHÔNG ĐƯỢC trả lời văn bản bình thường. Bạn PHẢI trả về DUY NHẤT một khối JSON hợp lệ chứa lệnh gọi. Ví dụ:\n{"tool": "query_market_data", "args": {"keyword": "thanh long"}}\n\nHệ thống sẽ tự động bắt lấy JSON này, chạy tool và gửi kết quả lại cho bạn để bạn có thông tin trả lời User. Nếu đã có đủ thông tin, hãy trả lời bình thường và đừng gọi tool.`;
  return manual;
};
