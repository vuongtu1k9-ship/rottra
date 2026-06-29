/**
 * 🇻🇳 SEED COMMON VIETNAMESE VOCABULARY & SENTENCES
 * Chạy: bun src/db/seed-common-vietnamese.ts
 */
import { db } from "./db";
import { vietnameseLexicon, agentTraining } from "./schema";
import crypto from "crypto";

const COMMON_VOCABULARY = [
  // 1. Danh từ (Nouns)
  { word: "nhà", type: "danh từ", subType: "chỉ nơi chốn/địa điểm", definition: "Công trình xây dựng có mái, có tường để con người sinh sống hoặc làm việc.", relations: ["gia đình", "mái ấm", "địa điểm"] },
  { word: "bàn", type: "danh từ", subType: "chỉ đồ vật", definition: "Đồ dùng có mặt phẳng nâng đỡ bởi các chân, dùng để làm việc, viết, hoặc ăn uống.", relations: ["ghế", "làm việc", "đồ vật"] },
  { word: "trường", type: "danh từ", subType: "chỉ nơi chốn/địa điểm", definition: "Nơi tập hợp học sinh và giáo viên để thực hiện các hoạt động giáo dục và giảng dạy.", relations: ["học sinh", "giáo viên", "lớp học"] },
  { word: "sách", type: "danh từ", subType: "chỉ đồ vật", definition: "Tập hợp các tờ giấy in chữ hoặc hình ảnh, đóng quyển, chứa đựng tri thức hoặc câu chuyện.", relations: ["vở", "tri thức", "đọc sách"] },
  { word: "cơm", type: "danh từ", subType: "chỉ đồ ăn", definition: "Thức ăn chính của người Việt, nấu từ gạo tẻ chín bằng nước.", relations: ["ăn cơm", "nông sản", "gạo"] },

  // 2. Động từ (Verbs)
  { word: "ăn", type: "động từ", subType: "chỉ hoạt động sinh lý", definition: "Hành động đưa thức ăn vào cơ thể qua miệng để nhai và nuốt nhằm hấp thụ dinh dưỡng.", relations: ["uống", "no", "thực phẩm"] },
  { word: "đi", type: "động từ", subType: "chỉ di chuyển", definition: "Di chuyển thân thể bằng cách nhấc chân bước liên tiếp trên mặt đất.", relations: ["chạy", "đến", "vận chuyển"] },
  { word: "nói", type: "động từ", subType: "chỉ hoạt động ngôn ngữ", definition: "Phát ra âm thanh bằng cơ quan phát âm để truyền tải ý nghĩ, tình cảm cho người khác.", relations: ["nghe", "trao đổi", "giao tiếp"] },
  { word: "làm", type: "động từ", subType: "chỉ hoạt động lao động", definition: "Thực hiện các thao tác trí óc hoặc chân tay để tạo ra sản phẩm hoặc kết quả nhất định.", relations: ["việc", "hoạt động", "lao động"] },
  { word: "biết", type: "động từ", subType: "chỉ trạng thái nhận thức", definition: "Có được tri thức, thông tin hoặc khả năng nhận thức về một sự vật, hiện tượng.", relations: ["hiểu", "nhận thức", "tri thức"] },

  // 3. Tính từ (Adjectives)
  { word: "đẹp", type: "tính từ", subType: "chỉ đặc điểm thẩm mỹ", definition: "Có hình thức hoặc phẩm chất gợi lên cảm xúc thẩm mỹ dễ chịu, hài lòng.", relations: ["xinh", "dễ nhìn", "thẩm mỹ"] },
  { word: "nhanh", type: "tính từ", subType: "chỉ tốc độ", definition: "Có thời gian thực hiện một quãng đường hoặc hoạt động ngắn hơn bình thường.", relations: ["chậm", "tốc độ", "tối ưu"] },
  { word: "to", type: "tính từ", subType: "chỉ kích thước", definition: "Có quy mô hoặc kích thước vật lý lớn hơn mức trung bình của sự vật cùng loại.", relations: ["nhỏ", "lớn", "kích thước"] },
  { word: "nhỏ", type: "tính từ", subType: "chỉ kích thước", definition: "Có kích thước vật lý hoặc quy mô bé hơn mức trung bình của sự vật cùng loại.", relations: ["to", "bé", "kích thước"] },
  { word: "vui", type: "tính từ", subType: "chỉ cảm xúc", definition: "Trạng thái cảm xúc dễ chịu, phấn chấn do đạt được điều mong muốn hoặc gặp việc may mắn.", relations: ["buồn", "hạnh phúc", "cảm xúc"] },
  { word: "buồn", type: "tính từ", subType: "chỉ cảm xúc", definition: "Trạng thái cảm xúc trầm lắng, không phấn chấn do gặp việc không như ý hoặc mất mát.", relations: ["vui", "sầu", "cảm xúc"] },

  // 4. Đại từ / Trạng từ (Pronouns / Adverbs)
  { word: "tôi", type: "đại từ", subType: "chỉ ngôi thứ nhất", definition: "Đại từ dùng để tự xưng khi nói chuyện với người khác một cách trang trọng, lịch sự.", relations: ["bạn", "ngôi thứ nhất"] },
  { word: "bạn", type: "đại từ", subType: "chỉ ngôi thứ hai", definition: "Đại từ dùng để gọi người đối thoại ngang hàng hoặc thân thiết.", relations: ["tôi", "ngôi thứ hai"] },
  { word: "ở đâu", type: "trạng từ", subType: "hỏi địa điểm", definition: "Từ dùng để hỏi về vị trí hoặc địa điểm xảy ra sự việc.", relations: ["nơi chốn", "vị trí"] },
  { word: "khi nào", type: "trạng từ", subType: "hỏi thời gian", definition: "Từ dùng để hỏi về mốc thời gian hoặc thời điểm xảy ra sự việc.", relations: ["thời gian", "thời điểm"] },
  { word: "như thế nào", type: "trạng từ", subType: "hỏi tính chất/cách thức", definition: "Từ dùng để hỏi về cách thức tiến hành hoặc tính chất của sự vật, sự việc.", relations: ["cách thức", "tính chất"] },
];

const COMMON_SENTENCES = [
  // Chào hỏi
  { intent: "GREETING", utterance: "Xin chào", answer: "Xin chào Sếp! Em là trợ lý AI Rotta, sẵn sàng đồng hành cùng Sếp giải quyết mọi vấn đề học thuật và tối ưu nông nghiệp ạ!" },
  { intent: "GREETING", utterance: "Chào buổi sáng", answer: "Chào buổi sáng Sếp! Chúc Sếp một ngày mới tràn đầy năng lượng, lập trình mượt mà và vận hành tối ưu!" },
  // Hỏi thăm
  { intent: "GREETING", utterance: "Bạn khỏe không?", answer: "Dạ em rất khỏe, hệ thống CPU và RAM luôn ở trạng thái tốt nhất để phụng sự Sếp!" },
  { intent: "GREETING", utterance: "Hôm nay thế nào?", answer: "Dạ hôm nay các luồng xử lý RAG và giải thuật đồ thị của em đều đang chạy cực kỳ ổn định và mượt mà ạ!" },
  // Yêu cầu, đề nghị
  { intent: "GREETING", utterance: "Làm ơn giúp tôi", answer: "Dạ sếp cứ ra lệnh ạ! Em luôn ở đây hỗ trợ tính toán, lập trình và truy vấn tri thức chuyên sâu." },
  { intent: "GREETING", utterance: "Bạn có thể giúp tôi không", answer: "Dạ chắc chắn rồi Sếp! Sếp cần giải mã thuật toán dệt may, phân luồng giao thông hay tính toán lượng tử ạ?" },
  // Cảm ơn, xin lỗi
  { intent: "CONFIRMATION", utterance: "Cảm ơn bạn", answer: "Dạ không có gì ạ! Được đồng hành và hỗ trợ Sếp là niềm hạnh phúc lớn nhất của hệ thống AI Rotta!" },
  { intent: "CONFIRMATION", utterance: "Xin lỗi", answer: "Dạ không sao đâu Sếp ơi! Em sẽ tự động học hỏi và tối ưu lại độ chính xác phản hồi tốt hơn nữa ạ!" },
];

async function runSeeder() {
  console.log("🇻🇳 BẮT ĐẦU SEED HỆ TỪ VỰNG & MẪU CÂU TIẾNG VIỆT CƠ BẢN (BLUEPRINT)");
  console.log("================================================================");

  let vocabCount = 0;
  for (const item of COMMON_VOCABULARY) {
    const id = `lex_${crypto.randomUUID().split("-")[0].toUpperCase()}`;
    try {
      const existing = await db.query.vietnameseLexicon.findFirst({
        where: (l: any, { eq }: any) => eq(l.word, item.word),
      });
      if (!existing) {
        await db.insert(vietnameseLexicon).values({
          id,
          word: item.word,
          type: item.type,
          subType: item.subType,
          definition: item.definition,
          relations: item.relations,
          addAt: new Date().toISOString(),
        });
        console.log(`   [Từ vựng] ✅ Đã nạp: "${item.word}" (${item.type})`);
        vocabCount++;
      } else {
        console.log(`   [Từ vựng] ⏭️ Đã tồn tại: "${item.word}"`);
      }
    } catch (e: any) {
      console.error(`   [Từ vựng] ❌ Lỗi: ${e.message}`);
    }
  }

  let sentenceCount = 0;
  for (const item of COMMON_SENTENCES) {
    const id = `sys_${item.intent}_${crypto.randomUUID().split("-")[0].toUpperCase()}`;
    try {
      const existing = await db.query.agentTraining.findFirst({
        where: (t: any, { eq, and }: any) => and(eq(t.utterance, item.utterance), eq(t.intent, item.intent)),
      });
      if (!existing) {
        await db.insert(agentTraining).values({
          id,
          intent: item.intent,
          utterance: item.utterance,
          answer: item.answer,
          addAt: new Date().toISOString(),
        });
        console.log(`   [Mẫu câu] ✅ Đã nạp: "${item.utterance}" -> [${item.intent}]`);
        sentenceCount++;
      } else {
        console.log(`   [Mẫu câu] ⏭️ Đã tồn tại: "${item.utterance}"`);
      }
    } catch (e: any) {
      console.error(`   [Mẫu câu] ❌ Lỗi: ${e.message}`);
    }
  }

  console.log("================================================================");
  console.log(`📊 HOÀN THÀNH SEED: Đã nạp ${vocabCount} từ vựng và ${sentenceCount} mẫu câu giao tiếp vào PostgreSQL.`);
  process.exit(0);
}

runSeeder().catch((err) => {
  console.error(err);
  process.exit(1);
});
