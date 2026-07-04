import { db } from "./db";
import { user, strategyPreset } from "./schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const PRESETS = [
  // 1. Core / Legend Presets
  {
    category: "Hệ Sinh Thái Độc Quyền 🏆",
    name: "Antigravity ProMax (Lõi Siêu AI) 🧠",
    description: "Sức mạnh công nghiệp AI tối tân, tư duy logic thập toàn thập mỹ, tích hợp hệ thống hoàn hảo và tự động hóa tuyệt đối.",
    values: [10, 9, 10, 10, 10, 10, 10, 9, 9, 10],
  },
  {
    category: "Hệ Sinh Thái Độc Quyền 🏆",
    name: "Tùy chỉnh cá nhân ✍️",
    description: "Nhấp và kéo các thanh trượt bên dưới để tự tay đánh giá AI Agent của riêng bạn.",
    values: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  },

  // 2. OpenAI
  {
    category: "Hệ Sinh Thái OpenAI ⚡",
    name: "GPT-4o (Omni) ⚡",
    description: "Tốc độ phản hồi cực nhanh, giao tiếp tự nhiên đỉnh cao với đa phương thức, suy luận logic vượt trội.",
    values: [9, 10, 9, 9, 8, 9, 8, 8, 9, 10],
  },
  {
    category: "Hệ Sinh Thái OpenAI ⚡",
    name: "GPT-4 Turbo 🐢",
    description: "Độ chính xác dữ liệu cực cao, phân tích ngữ cảnh phức tạp nhưng tốc độ phản hồi có phần chậm hơn bản Omni.",
    values: [10, 6, 9, 10, 8, 8, 8, 8, 9, 8],
  },
  {
    category: "Hệ Sinh Thái OpenAI ⚡",
    name: "GPT-3.5 (Legacy) 📉",
    description: "AI thế hệ cũ, tốc độ siêu nhanh nhưng khả năng suy luận và độ chính xác đã bộc lộ nhiều điểm yếu so với hiện tại.",
    values: [5, 10, 5, 5, 4, 6, 6, 6, 6, 7],
  },

  // 3. Anthropic & Google
  {
    category: "Anthropic & Google 🌍",
    name: "Claude 3.5 Sonnet 🎨",
    description: "Khả năng viết lách mượt mà như con người, thấu hiểu ngữ cảnh vô song, code cực kỳ thông minh.",
    values: [10, 8, 9, 10, 8, 8, 7, 9, 10, 9],
  },
  {
    category: "Anthropic & Google 🌍",
    name: "Claude 3 Opus 📚",
    description: "Mô hình nặng nhất của Anthropic, khả năng suy luận logic cực mạnh, nhưng tốc độ phản hồi khá chậm.",
    values: [10, 5, 9, 10, 8, 7, 6, 9, 9, 8],
  },
  {
    category: "Anthropic & Google 🌍",
    name: "Gemini 1.5 Pro 🌌",
    description: "Context window siêu lớn (2M tokens), cực kỳ vượt trội trong việc tích hợp dữ liệu hệ thống khổng lồ.",
    values: [9, 7, 9, 10, 9, 9, 10, 8, 8, 8],
  },
  {
    category: "Anthropic & Google 🌍",
    name: "Gemini 1.5 Flash ⚡",
    description: "Nhẹ, nhanh, tối ưu chi phí, khả năng xử lý đa nhiệm liên tục với tốc độ cao.",
    values: [7, 10, 7, 7, 8, 10, 8, 7, 7, 8],
  },

  // 4. Open Source
  {
    category: "Mã Nguồn Mở (Open Source) 🦙",
    name: "Llama 3 (70B) 🦙",
    description: "Mã nguồn mở đỉnh cao của Meta, suy luận cực tốt không kém các mô hình trả phí, linh hoạt trong triển khai.",
    values: [8, 8, 8, 8, 9, 8, 9, 10, 8, 8],
  },
  {
    category: "Mã Nguồn Mở (Open Source) 🦙",
    name: "Mistral Large 🌪️",
    description: "AI đến từ Châu Âu, khả năng xử lý đa ngôn ngữ tuyệt vời, bảo mật và an toàn cực cao.",
    values: [8, 7, 8, 8, 8, 8, 8, 9, 8, 8],
  },
  {
    category: "Mã Nguồn Mở (Open Source) 🦙",
    name: "Rottra AI 🤖",
    description: "Mô hình ngôn ngữ cục bộ tối ưu hóa riêng cho hệ thống đại lý thông minh Rottra.",
    values: [9, 8, 8, 8, 8, 8, 8, 8, 7, 7],
  },
];

const DEFAULT_DIMENSIONS = ["SUY LUẬN & LOGIC", "TỐC ĐỘ PHẢN HỒI", "ĐỘ CHÍNH XÁC DỮ LIỆU", "THẤU HIỂU NGỮ CẢNH", "KHẢ NĂNG TỰ HỌC", "QUẢN LÝ ĐA NHIỆM", "TÍCH HỢP HỆ THỐNG", "AN TOÀN & BẢO MẬT", "SÁNG TẠO NỘI DUNG", "GIAO TIẾP TỰ NHIÊN"];

async function seed() {
  console.log("Tìm kiếm tài khoản admin hoặc agent thực tế để gán preset...");
  let targetUser = await db.query.user.findFirst({
    where: eq(user.email, "admin@Rottra.com")
  });
  if (!targetUser) {
    targetUser = await db.query.user.findFirst({
      where: eq(user.email, "agent@Rottra.com")
    });
  }
  if (!targetUser) {
    console.log("Không tìm thấy admin@Rottra.com hoặc agent@Rottra.com. Đang khởi tạo system_agent_user...");
    const [insertedUser] = await db.insert(user).values({
      id: "system_agent_user",
      name: "Trợ Lý Cao Cấp Rottra",
      email: "agent@Rottra.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "agent",
      username: "agent_Rottra",
    }).onConflictDoNothing().returning();
    targetUser = insertedUser || { id: "system_agent_user" } as any;
  }
  const adminId = targetUser.id;

  console.log("Xóa toàn bộ Strategy Preset cũ...");
  await db.delete(strategyPreset);

  console.log("Bắt đầu chèn AI Presets mới vào CSDL...");
  const records = PRESETS.map((p) => ({
    id: uuidv4(),
    userId: adminId,
    name: p.name,
    description: p.description,
    category: p.category,
    values: p.values,
    dimensions: DEFAULT_DIMENSIONS,
  }));

  await db.insert(strategyPreset).values(records);
  console.log("🎉 Hoàn tất chèn dữ liệu AI Presets vào CSDL!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});
