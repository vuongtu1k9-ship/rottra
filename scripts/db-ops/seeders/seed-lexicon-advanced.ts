/**
 * 🇻🇳 ROTTRA VIETNAMESE LEXICON ADVANCED SEED
 * Chạy: bun src/db/seed-lexicon-advanced.ts
 */
import { db } from "./db";
import { vietnameseLexicon } from "./schema";
import crypto from "crypto";

const ADVANCED_LEXICON_DATA = [
  // 1. TỪ LOẠI (PARTS OF SPEECH)
  {
    word: "danh từ",
    type: "từ loại",
    subType: "chỉ người, vật, hiện tượng, khái niệm",
    definition: "Từ chỉ thực thể tự nhiên hoặc xã hội. Ví dụ: học sinh, bàn ghế, tình yêu.",
    relations: ["học sinh", "bàn ghế", "tình yêu", "chủ ngữ"],
  },
  {
    word: "động từ",
    type: "từ loại",
    subType: "chỉ hoạt động, trạng thái",
    definition: "Từ chỉ hành động, chuyển động hoặc trạng thái tồn tại. Ví dụ: chạy, ăn, ngủ, tồn tại.",
    relations: ["chạy", "ăn", "ngủ", "tồn tại", "vị ngữ"],
  },
  {
    word: "tính từ",
    type: "từ loại",
    subType: "chỉ đặc điểm, tính chất",
    definition: "Từ chỉ tính chất, đặc trưng của sự vật, hoạt động, trạng thái. Ví dụ: đẹp, cao, nhanh.",
    relations: ["đẹp", "cao", "nhanh", "vị ngữ"],
  },
  {
    word: "đại từ",
    type: "từ loại",
    subType: "dùng để xưng hô hoặc thay thế",
    definition: "Từ dùng để trỏ người, vật, hoạt động, tính chất được nói đến trong ngữ cảnh. Ví dụ: tôi, họ, ai, này.",
    relations: ["tôi", "họ", "ai", "này"],
  },
  {
    word: "số từ",
    type: "từ loại",
    subType: "chỉ số lượng, thứ tự",
    definition: "Từ chỉ số lượng cụ thể hoặc thứ tự của sự vật. Ví dụ: một, hai, thứ ba.",
    relations: ["một", "hai", "thứ ba"],
  },
  {
    word: "lượng từ",
    type: "từ loại",
    subType: "chỉ lượng ít/nhiều",
    definition: "Từ dùng để biểu thị lượng ước chừng của danh từ đứng sau. Ví dụ: những, các, mọi.",
    relations: ["những", "các", "mọi"],
  },
  {
    word: "chỉ từ",
    type: "từ loại",
    subType: "dùng để trỏ",
    definition: "Từ dùng để trỏ vào sự vật nhằm xác định vị trí của sự vật trong không gian hoặc thời gian. Ví dụ: này, kia, ấy.",
    relations: ["này", "kia", "ấy"],
  },
  {
    word: "phó từ",
    type: "từ loại",
    subType: "bổ sung ý nghĩa cho động từ/tính từ",
    definition: "Từ chuyên đi kèm động từ, tính từ để bổ sung ý nghĩa về thời gian, mức độ, sự tiếp diễn. Ví dụ: đã, sẽ, rất, hơi.",
    relations: ["đã", "sẽ", "rất", "hơi"],
  },
  {
    word: "quan hệ từ",
    type: "từ loại",
    subType: "nối các thành phần câu",
    definition: "Từ dùng để liên kết các thành phần câu hoặc các câu với nhau, biểu thị quan hệ ngữ nghĩa. Ví dụ: và, nhưng, vì, nếu.",
    relations: ["và", "nhưng", "vì", "nếu"],
  },
  {
    word: "trợ từ",
    type: "từ loại",
    subType: "nhấn mạnh hoặc biểu thị sắc thái",
    definition: "Từ chuyên đi kèm các từ ngữ khác trong câu để nhấn mạnh hoặc biểu thị thái độ đánh giá. Ví dụ: chính, ngay, có.",
    relations: ["chính", "ngay", "có"],
  },
  {
    word: "thán từ",
    type: "từ loại",
    subType: "biểu lộ cảm xúc",
    definition: "Từ dùng để bộc lộ cảm xúc, tình cảm của người nói hoặc dùng để gọi đáp. Ví dụ: ôi, chao, ái.",
    relations: ["ôi", "chao", "ái"],
  },
  {
    word: "tình thái từ",
    type: "từ loại",
    subType: "biểu thái độ, sắc thái câu nói",
    definition: "Từ được thêm vào câu để cấu tạo câu nghi vấn, câu cầu khiến, câu cảm thán hoặc biểu thị thái độ. Ví dụ: à, nhé, cơ, thôi.",
    relations: ["à", "nhé", "cơ", "thôi"],
  },

  // 2. CẤU TRÚC TỪ (WORD STRUCTURE)
  {
    word: "từ đơn",
    type: "cấu trúc từ",
    subType: "chỉ có một tiếng",
    definition: "Từ gồm một tiếng duy nhất cấu tạo nên và có nghĩa hoàn chỉnh. Ví dụ: ăn, học, đẹp.",
    relations: ["ăn", "học", "đẹp"],
  },
  {
    word: "từ phức",
    type: "cấu trúc từ",
    subType: "gồm từ 2 tiếng trở lên",
    definition: "Từ gồm hai tiếng trở lên tạo thành, chia làm hai loại chính: từ ghép và từ láy.",
    relations: ["từ ghép", "từ láy", "học sinh", "nhà cửa", "lung linh"],
  },
  {
    word: "từ ghép",
    type: "cấu trúc từ",
    subType: "tiếng có quan hệ ngữ nghĩa với nhau",
    definition: "Từ phức được tạo ra bằng cách ghép các tiếng có quan hệ về nghĩa với nhau. Ví dụ: học sinh, nhà cửa.",
    relations: ["từ phức", "học sinh", "nhà cửa"],
  },
  {
    word: "từ láy",
    type: "cấu trúc từ",
    subType: "lặp âm hoặc vần",
    definition: "Từ phức được tạo ra bằng cách phối hợp các tiếng có quan hệ láy âm, vần hoặc cả hai. Ví dụ: lung linh, lấp lánh.",
    relations: ["từ phức", "lung linh", "lấp lánh"],
  },

  // 3. QUAN HỆ NGỮ NGHĨA (SEMANTIC RELATIONS)
  {
    word: "từ đồng nghĩa",
    type: "ngữ nghĩa",
    subType: "nghĩa giống/gần giống",
    definition: "Những từ có nghĩa giống nhau hoặc gần giống nhau trong một số ngữ cảnh nhất định. Ví dụ: chăm chỉ – siêng năng.",
    relations: ["chăm chỉ", "siêng năng"],
  },
  {
    word: "từ trái nghĩa",
    type: "ngữ nghĩa",
    subType: "đối lập nghĩa hoàn toàn",
    definition: "Những từ có ý nghĩa hoàn toàn đối lập nhau trên cùng một thang đo giá trị. Ví dụ: cao – thấp.",
    relations: ["cao", "thấp"],
  },
  {
    word: "từ nhiều nghĩa",
    type: "ngữ nghĩa",
    subType: "một từ có nhiều nghĩa phái sinh",
    definition: "Từ có một nghĩa gốc và một hoặc nhiều nghĩa chuyển dựa trên mối liên hệ tương đồng hoặc tiếp cận. Ví dụ: 'chân' (chân người, chân bàn).",
    relations: ["chân", "chân người", "chân bàn"],
  },
  {
    word: "từ đồng âm",
    type: "ngữ nghĩa",
    subType: "phát âm giống nhau nhưng nghĩa khác nhau",
    definition: "Những từ trùng nhau về hình thức ngữ âm nhưng hoàn toàn khác nhau về mặt ngữ nghĩa. Ví dụ: 'đường' (con đường / đường ăn).",
    relations: ["đường", "con đường", "đường ăn"],
  },

  // 4. THÀNH PHẦN CÂU (SENTENCE COMPONENTS)
  {
    word: "chủ ngữ",
    type: "thành phần câu",
    subType: "người/vật thực hiện hành động hoặc được nói đến",
    definition: "Thành phần chính của câu, chỉ chủ thể của hoạt động, đặc điểm, trạng thái nêu ở vị ngữ. Trả lời câu hỏi: Ai?, Cái gì?, Con gì?.",
    relations: ["Lan", "vị ngữ", "trạng ngữ"],
  },
  {
    word: "vị ngữ",
    type: "thành phần câu",
    subType: "nói về hoạt động, đặc điểm, trạng thái của chủ ngữ",
    definition: "Thành phần chính của câu, biểu thị hoạt động, trạng thái, đặc điểm của chủ thể nêu ở chủ ngữ. Trả lời câu hỏi: Làm gì?, Thế nào?, Là gì?.",
    relations: ["học bài", "chủ ngữ", "trạng ngữ"],
  },
  {
    word: "trạng ngữ",
    type: "thành phần câu",
    subType: "chỉ thời gian, nơi chốn, nguyên nhân...",
    definition: "Thành phần phụ của câu, bổ sung ý nghĩa tình thái về thời gian, địa điểm, phương tiện, cách thức cho nòng cốt câu.",
    relations: ["hôm nay", "chủ ngữ", "vị ngữ"],
  },

  // 5. CÁC TỪ VỰNG CHI TIẾT ĐỂ PARSER BẢNG NGỮ PHÁP TIẾNG VIỆT
  { word: "em", type: "danh từ", subType: "chỉ người/xưng hô", definition: "Từ chỉ người em hoặc dùng làm đại từ xưng hô thân mật.", relations: ["em", "danh từ", "đại từ"] },
  { word: "đang", type: "phó từ", subType: "chỉ sự tiếp diễn", definition: "Phó từ chỉ hoạt động, trạng thái đang diễn ra trong hiện tại.", relations: ["đang", "phó từ"] },
  { word: "học", type: "động từ", subType: "chỉ hoạt động", definition: "Hành động tiếp thu kiến thức, rèn luyện kỹ năng dưới sự chỉ dẫn hoặc tự tìm tòi.", relations: ["học", "động từ"] },
  { word: "rất", type: "phó từ", subType: "chỉ mức độ", definition: "Phó từ biểu thị mức độ cao của tính chất, đặc điểm.", relations: ["rất", "phó từ"] },
  { word: "chăm chỉ", type: "tính từ", subType: "chỉ đặc điểm", definition: "Đặc điểm làm việc một cách liên tục, siêng năng và có trách nhiệm.", relations: ["chăm chỉ", "tính từ", "siêng năng"] },
  { word: "siêng năng", type: "tính từ", subType: "chỉ đặc điểm", definition: "Đặc điểm chăm chỉ, cần cù chịu khó làm việc hoặc học tập.", relations: ["siêng năng", "tính từ", "chăm chỉ"] },
  { word: "lan", type: "danh từ", subType: "tên riêng", definition: "Tên người riêng, thường đóng vai trò chủ ngữ.", relations: ["Lan", "chủ ngữ"] },
  { word: "học bài", type: "động từ", subType: "hoạt động cụm", definition: "Hành động ôn tập kiến thức, đọc sách chuẩn bị cho bài học.", relations: ["học bài", "vị ngữ"] },
  { word: "hôm nay", type: "danh từ", subType: "thời gian", definition: "Danh từ chỉ ngày hiện tại, thường đóng vai trò trạng ngữ chỉ thời gian.", relations: ["hôm nay", "trạng ngữ"] },
];

async function main() {
  console.log("🇻🇳 Bắt đầu nạp Ngữ pháp và Cấu trúc tiếng Việt Nâng cao — Rottra Advanced Lexicon");
  console.log("══════════════════════════════════════════════════════════════════════════════");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const item of ADVANCED_LEXICON_DATA) {
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
        console.log(`   ✅ Đã nạp thành công từ: "${item.word}" (${item.type})`);
        totalInserted++;
      } else {
        console.log(`   ⏭️ Bỏ qua từ đã tồn tại: "${item.word}"`);
        totalSkipped++;
      }
    } catch (e: any) {
      console.error(`   ❌ Lỗi nạp từ [${item.word}]: ${e.message}`);
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.log(`📊 Hoàn thành: Đã thêm ${totalInserted} từ mới, bỏ qua ${totalSkipped} từ trùng lặp.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
