import "dotenv/config";
import { db } from "./db";
import { agentTraining } from "./schema";
import { like } from "drizzle-orm";
import crypto from "crypto";

const generateId = () => crypto.randomBytes(8).toString("hex");

const psychologyData = [
  {
    intent: "EDUCATION_PSYCHOLOGY_SOCIAL_PROOF",
    utterance: "tâm lý học xã hội bằng chứng xã hội lan truyền đám đông social proof hiệu ứng asch cialdini",
    answer: "👥 **[TÂM LÝ HỌC XÃ HỘI: BẰNG CHỨNG XÃ HỘI & SỰ TUÂN THỦ]**\n\n**1. Lý thuyết cốt lõi (Social Proof & Conformity):**\n- **Bằng chứng xã hội (Robert Cialdini):** Con người có xu hướng nhìn vào hành vi của người khác để quyết định hành động của chính mình, đặc biệt là trong các tình huống mơ hồ.\n- **Thí nghiệm sự tuân thủ (Solomon Asch):** Chứng minh rằng cá nhân sẵn sàng trả lời sai một câu hỏi rõ ràng chỉ để hòa nhập và không bị khác biệt so với số đông trong nhóm.\n\n**2. Ứng dụng thực tiễn trong Nông nghiệp số Rottra:**\n- Khi giới thiệu công nghệ IoT hoặc nông sản hữu cơ tiêu chuẩn VietGAP, việc đưa ra phản hồi thực tế từ các hợp tác xã đi đầu (Bằng chứng xã hội) sẽ tạo động lực lan truyền mạnh mẽ hơn gấp 4 lần so với các quảng cáo kỹ thuật thuần túy.",
  },
  {
    intent: "EDUCATION_PSYCHOLOGY_COGNITIVE_DISSONANCE",
    utterance: "sự bất hòa nhận thức cognitive dissonance leon festinger",
    answer: "🧠 **[TÂM LÝ HỌC XÃ HỘI: SỰ BẤT HÒA NHẬN THỨC]**\n\n**1. Lý thuyết cốt lõi (Cognitive Dissonance - Leon Festinger):**\n- Xảy ra khi một người giữ hai nhận thức hoặc niềm tin xung đột nhau, hoặc khi hành vi của họ mâu thuẫn với niềm tin sẵn có. Trạng thái này gây ra sự khó chịu tâm lý cực độ.\n- Con người sẽ tự động tìm cách giảm thiểu sự bất hòa bằng cách thay đổi niềm tin, thay đổi hành vi, hoặc tự hợp lý hóa hành động (Self-rationalization).\n\n**2. Ứng dụng thực tiễn trong mua sắm nông sản sạch:**\n- Người tiêu dùng muốn ăn uống lành mạnh (Nhận thức 1) nhưng lại hay mua thực phẩm rẻ không rõ nguồn gốc (Hành vi). \n- Rottra hỗ trợ xóa tan sự bất hòa nhận thức này bằng cách cung cấp minh bạch **truy xuất nguồn gốc QR code**, giúp khách hàng tự tin rằng quyết định mua sản phẩm cao cấp VietGAP hoàn toàn khớp với mục tiêu sống khỏe của họ.",
  },
  {
    intent: "EDUCATION_PSYCHOLOGY_BYSTANDER",
    utterance: "hiệu ứng người ngoài cuộc bystander effect khuếch tán trách nhiệm latane darley",
    answer: "🤝 **[TÂM LÝ HỌC XÃ HỘI: HIỆU ỨNG NGƯỜI NGOÀI CUỘC]**\n\n**1. Lý thuyết cốt lõi (Bystander Effect - Latané & Darley):**\n- Hiệu ứng tâm lý trong đó mọi người ít có khả năng đề xuất trợ giúp cho một nạn nhân hoặc thực hiện hành động tập thể khi có sự hiện diện của những người khác.\n- Nguyên nhân chính là do sự **Khuếch tán trách nhiệm (Diffusion of responsibility)** - ai cũng nghĩ sẽ có người khác làm thay mình.\n\n**2. Ứng dụng thực tiễn trong Hợp tác xã:**\n- Trong một hợp tác xã dùng chung kênh mương tưới tiêu hoặc chia sẻ dữ liệu mùa vụ, nếu không giao chỉ tiêu cụ thể cho từng hộ gia đình mà chỉ kêu gọi chung chung, hiệu ứng người ngoài cuộc sẽ khiến hạ tầng bị bỏ hoang.\n- Hệ thống Rottra giải quyết triệt để bằng cách số hóa phân quyền, chỉ định nhiệm vụ rõ ràng và gửi thông báo trực tiếp đến thiết bị di động của từng thành viên.",
  },
];

async function seedPsychology() {
  console.log("🧠 Đang dọn dẹp và nạp giáo trình Tâm lý học Xã hội mới...");
  try {
    // Xóa trước để tránh trùng lặp
    await db.delete(agentTraining).where(like(agentTraining.intent, "EDUCATION_PSYCHOLOGY_%"));

    let count = 0;
    for (const item of psychologyData) {
      await db.insert(agentTraining).values({
        id: generateId(),
        intent: item.intent,
        utterance: item.utterance,
        answer: item.answer,
      });
      count++;
      console.log(`  => Đã nạp kiến thức: [${item.intent}]`);
    }

    console.log(`\n🎉 Thành công! Đã nạp ${count} kiến thức Tâm lý học Xã hội vào CSDL!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Thất bại khi nạp giáo trình:", error);
    process.exit(1);
  }
}

seedPsychology();
