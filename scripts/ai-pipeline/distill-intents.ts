import "dotenv/config";
import { generateTextLocal } from "../src/lib/agent/ai-sdk";
import { trainAndSaveNlpModel } from "../src/lib/agent/nlp";
import { db } from "../src/db/db";
import { agentTraining } from "../src/db/schema";
import crypto from "crypto";

console.log("🚀 [Rottra Core] Bắt đầu chưng cất đặc trưng từ mô hình lớn (Groq/CocoLink) để tối ưu hóa AI...");

const INTENT_DESCRIPTIONS: Record<string, { desc: string; sampleAnswer: string }> = {
  STATISTICS: {
    desc: "Tính toán xác suất, kỳ vọng, phương sai, lọc Kalman, độ lệch chuẩn, các công thức toán học thống kê.",
    sampleAnswer: "Để tính toán kỳ vọng của sản lượng lúa ST25, ta lấy tổng của tích các giá trị sản lượng nhân với xác suất tương ứng..."
  },
  FORECAST: {
    desc: "Dự báo thời tiết, dự báo sản lượng lúa mùa sau, mô hình dự báo ARIMA, dự báo lượng mưa bằng KNN.",
    sampleAnswer: "Dự báo mô hình ARIMA cho thấy sản lượng lúa ST25 vụ sau có thể tăng 12% nhờ lượng mưa trung bình ổn định..."
  },
  NPV: {
    desc: "Tính toán NPV (Net Present Value - Giá trị hiện tại thuần), CBA (Cost-Benefit Analysis) để thẩm định dự án nông nghiệp.",
    sampleAnswer: "Công thức tính NPV = \\sum [CF_t / (1 + r)^t] - C_0. Với lãi suất r = 10%, dự án cải tạo đất của sếp có NPV dương..."
  },
  TSP: {
    desc: "Giải bài toán người bán hàng Travelling Salesperson Problem, tìm đường đi thu gom nông sản ngắn nhất qua các nông trại.",
    sampleAnswer: "Giải thuật TSP tối ưu hóa lộ trình xe tải thu gom lúa ST25 qua 5 hợp tác xã, rút ngắn quãng đường đi xuống còn 42km..."
  },
  COBWEB: {
    desc: "Phân tích giá nông sản bấp bênh dựa trên mô hình mạng nhện Cobweb (cung và cầu biến động trễ pha).",
    sampleAnswer: "Mô hình mạng nhện cho thấy giá tiêu đang dao động điều hòa do người dân có độ trễ pha khi phản ứng với giá năm ngoái..."
  },
  KALMAN: {
    desc: "Giải thích lọc nhiễu Kalman Filter cho các cảm biến đất đai, độ ẩm, nhiệt độ IoT để khử nhiễu môi trường.",
    sampleAnswer: "Bộ lọc Kalman tiến hành dự đoán trạng thái tiếp theo và cập nhật phép đo độ ẩm đất, khử sạch nhiễu cảm biến..."
  },
  VIETNAMESE_NATURAL: {
    desc: "Hội thoại tự nhiên Tiếng Việt, các câu hỏi han thông thường, tục ngữ nông nghiệp Việt Nam, chào hỏi thân thiện.",
    sampleAnswer: "Dạ em chào sếp! Chúc sếp một ngày bội thu nông sản. Em có thể hỗ trợ sếp phân tích số liệu hay lập kế hoạch nông vụ hôm nay?"
  },
  ANALYZE_MARKET: {
    desc: "Phân tích thị trường nông sản, so sánh giá lúa, tiêu, cà phê, tìm kiếm sản phẩm đang cháy hàng để tăng biên lợi nhuận.",
    sampleAnswer: "Thị trường cà phê đang có xu hướng tăng mạnh do hạn hán. Sếp nên cân nhắc chốt hợp đồng sớm để tối đa hóa biên lợi nhuận..."
  }
};

async function runDistill() {
  const keys = Object.keys(INTENT_DESCRIPTIONS);

  for (const intent of keys) {
    const { desc, sampleAnswer } = INTENT_DESCRIPTIONS[intent];
    console.log(`🤖 Đang yêu cầu mô hình lớn sinh 8 mẫu câu hỏi cho ý định [${intent}]...`);

    const prompt = `Bạn là một chuyên gia ngôn ngữ học tiếng Việt. 
Hãy sinh ra đúng 8 mẫu câu hỏi hoặc yêu cầu khác nhau bằng tiếng Việt thực tế, tự nhiên của nông dân, thương nhân hoặc người quản lý nông trại gửi cho hệ thống AI trợ lý Rottra thể hiện ý định: [${intent}].
Mô tả ý định: "${desc}"

Yêu cầu định dạng:
- Trả về danh sách mẫu câu dưới dạng một mảng JSON các chuỗi string thô.
- Không có bất kỳ phần giải thích hay markdown nào ngoài chuỗi JSON.
Ví dụ:
[
  "câu hỏi số một",
  "yêu cầu số hai"
]`;

    try {
      const response = await generateTextLocal({
        system: "You are a Vietnamese NLP dataset generator. Respond ONLY with a valid JSON array of strings containing natural Vietnamese user queries.",
        prompt: prompt
      });

      const text = response.text.trim();
      // Parse JSON
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]") + 1;
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Không tìm thấy định dạng JSON mảng trong kết quả LLM.");
      }

      const utterances: string[] = JSON.parse(text.substring(jsonStart, jsonEnd));
      console.log(`✨ Đã sinh thành công ${utterances.length} mẫu câu cho [${intent}]. Đang nạp vào cơ sở dữ liệu...`);

      for (const utterance of utterances) {
        const id = crypto.randomUUID();
        await db.insert(agentTraining).values({
          id,
          intent,
          utterance: utterance.trim(),
          answer: sampleAnswer
        });
      }
    } catch (err: any) {
      console.error(`❌ Gặp lỗi khi sinh dữ liệu cho ${intent}:`, err.message);
    }
  }

  console.log("💾 Đang tái huấn luyện bộ phân loại ý định (NLP Classifier Engine) bằng các tri thức mới chưng cất...");
  const trainRes = await trainAndSaveNlpModel();
  if (trainRes.success) {
    console.log("🎉 Huấn luyện thành công!");
    trainRes.logs.forEach(log => console.log(`  > ${log}`));
  } else {
    console.error("⚠️ Huấn luyện thất bại.");
  }

  console.log("🚀 [Rottra Core] QUÁ TRÌNH CHƯNG CẤT HOÀN TẤT MỸ MÃN!");
  process.exit(0);
}

runDistill();
