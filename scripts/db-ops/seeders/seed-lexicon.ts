/**
 * 🇻🇳 ROTTRA VIETNAMESE LEXICON SEED — Nạp dữ liệu cấu trúc từ vựng tiếng Việt
 * Chạy: bun src/db/seed-lexicon.ts
 */
import { db } from "./db";
import { vietnameseLexicon } from "./schema";
import crypto from "crypto";

const LEXICON_SEED_DATA = [
  // 1. TỪ GHÉP (COMPOUND WORDS)
  {
    word: "học sinh",
    type: "compound",
    subType: "ghép đẳng lập",
    definition: "Người đang theo học ở các trường phổ thông dưới sự dạy dỗ của giáo viên.",
    relations: ["trường học", "thầy giáo", "sách vở"],
  },
  {
    word: "thành phố",
    type: "compound",
    subType: "ghép đẳng lập",
    definition: "Khu vực đô thị lớn, tập trung dân cư đông đúc và là trung tâm kinh tế, chính trị.",
    relations: ["đô thị", "dân cư", "giao thông"],
  },
  {
    word: "nông nghiệp",
    type: "compound",
    subType: "ghép chính phụ",
    definition: "Ngành sản xuất vật chất cơ bản của xã hội, sử dụng đất đai để trồng trọt và chăn nuôi.",
    relations: ["nông trại", "trồng trọt", "chăn nuôi", "nông dân"],
  },
  {
    word: "bản đồ",
    type: "compound",
    subType: "ghép chính phụ",
    definition: "Hình vẽ thu nhỏ tương đối chính xác của một khu vực hoặc toàn bộ Trái Đất trên mặt phẳng.",
    relations: ["địa lý", "tọa độ", "định vị"],
  },
  {
    word: "chiến lược",
    type: "compound",
    subType: "ghép chính phụ",
    definition: "Kế hoạch hành động dài hạn được thiết kế để đạt được một mục tiêu cụ thể.",
    relations: ["kế hoạch", "tầm nhìn", "tối ưu"],
  },
  {
    word: "cảm biến",
    type: "compound",
    subType: "ghép chính phụ",
    definition: "Thiết bị điện tử phát hiện và đo lường sự thay đổi vật lý trong môi trường.",
    relations: ["thiết bị", "nhiệt độ", "độ ẩm", "Kalman"],
  },

  // 2. TỪ LÁY (REDUPLICATIVE WORDS)
  {
    word: "lung linh",
    type: "reduplicative",
    subType: "láy bộ phận (láy âm đầu 'l')",
    definition: "Có ánh sáng phát ra không đều, lúc tỏ lúc mờ, lay động, trông đẹp mắt.",
    relations: ["lấp lánh", "ánh sáng", "thẩm mỹ"],
  },
  {
    word: "đo đỏ",
    type: "reduplicative",
    subType: "láy giảm nhẹ (láy âm)",
    definition: "Hơi đỏ, có sắc đỏ nhạt hoặc không đỏ hẳn.",
    relations: ["màu đỏ", "nhẹ nhàng"],
  },
  {
    word: "rầm rập",
    type: "reduplicative",
    subType: "láy bộ phận (láy vần 'âm' - 'ập')",
    definition: "Mô tả âm thanh tiếng chân của một đám đông di chuyển nhanh, mạnh và đều đặn.",
    relations: ["âm thanh", "mạnh mẽ", "đông đúc"],
  },
  {
    word: "xôn xao",
    type: "reduplicative",
    subType: "láy bộ phận (láy âm đầu 'x')",
    definition: "Mô tả nhiều âm thanh nhỏ xen lẫn vào nhau, phát ra liên tiếp nghe không rõ.",
    relations: ["âm thanh", "nhộn nhịp", "náo nhiệt"],
  },
  {
    word: "bâng khuâng",
    type: "reduplicative",
    subType: "láy bộ phận (láy vần 'âng' - 'uâng')",
    definition: "Trạng thái tình cảm mơ hồ, luyến tiếc, nhớ thương xen lẫn nhau, không rõ rệt.",
    relations: ["tâm trạng", "cảm xúc", "nhớ nhung"],
  },
  {
    word: "rì rào",
    type: "reduplicative",
    subType: "láy bộ phận (láy vần)",
    definition: "Mô tả âm thanh nhỏ, nhẹ, phát ra đều đặn liên tiếp như tiếng gió thổi qua lá cây.",
    relations: ["âm thanh", "thiên nhiên", "nhẹ nhàng"],
  },

  // 3. TỪ ĐỐI (ANTONYMS/OPPOSITES)
  {
    word: "ngày - đêm",
    type: "antonym",
    subType: "đối cực",
    definition: "Chu kỳ ánh sáng và bóng tối tự nhiên do chuyển động tự quay của Trái Đất.",
    relations: ["ngày", "đêm", "chu kỳ", "thời gian"],
  },
  {
    word: "nhanh - chậm",
    type: "antonym",
    subType: "đối lập thang đo tốc độ",
    definition: "Sự khác biệt về thời gian cần thiết để hoàn thành một quãng đường hoặc một công việc.",
    relations: ["nhanh", "chậm", "tốc độ", "tối ưu"],
  },
  {
    word: "cao - thấp",
    type: "antonym",
    subType: "đối lập kích thước không gian",
    definition: "Mức độ khoảng cách thẳng đứng từ dưới lên trên so với một mặt phẳng chuẩn.",
    relations: ["cao", "thấp", "kích thước", "tọa độ"],
  },
  {
    word: "tốt - xấu",
    type: "antonym",
    subType: "đối lập giá trị đạo đức/chất lượng",
    definition: "Đánh giá về tính hữu ích, đạo đức hoặc chất lượng của một sự vật, hiện tượng.",
    relations: ["tốt", "xấu", "chất lượng", "đánh giá"],
  },
  {
    word: "nóng - lạnh",
    type: "antonym",
    subType: "đối lập nhiệt độ vật lý",
    definition: "Cảm giác nhiệt hoặc mức độ động năng của các phân tử trong môi trường.",
    relations: ["nóng", "lạnh", "nhiệt độ", "cảm biến"],
  },
  {
    word: "sáng - tối",
    type: "antonym",
    subType: "đối lập cường độ ánh sáng",
    definition: "Mức độ chiếu sáng hoặc sự có mặt của ánh sáng trong một không gian cụ thể.",
    relations: ["sáng", "tối", "ánh sáng", "độ rọi"],
  },

  // 4. TỪ ĐỒNG NGHĨA (SYNONYMS)
  {
    word: "đẹp - xinh",
    type: "synonym",
    subType: "đồng nghĩa hoàn toàn",
    definition: "Có hình thức hoặc phẩm chất gợi lên cảm xúc thẩm mỹ dễ chịu, hài lòng.",
    relations: ["đẹp", "xinh", "thẩm mỹ", "dễ thương"],
  },
  {
    word: "to - lớn",
    type: "synonym",
    subType: "đồng nghĩa mức độ",
    definition: "Có kích thước, quy mô vượt trội hơn mức trung bình của những sự vật cùng loại.",
    relations: ["to", "lớn", "kích thước", "quy mô"],
  },
];

async function main() {
  console.log("🇻🇳 Bắt đầu nạp CSDL Ngôn ngữ học Tiếng Việt — Rotta Lexicon");
  console.log("══════════════════════════════════════════════════════════");

  let totalInserted = 0;

  for (const item of LEXICON_SEED_DATA) {
    const id = `lex_${crypto.randomUUID().split("-")[0].toUpperCase()}`;

    try {
      await db
        .insert(vietnameseLexicon)
        .values({
          id,
          word: item.word,
          type: item.type,
          subType: item.subType,
          definition: item.definition,
          relations: item.relations,
          addAt: new Date().toISOString(),
        })
        .onConflictDoNothing();

      console.log(`   ✅ Đã nạp thành công từ: "${item.word}" (${item.type})`);
      totalInserted++;
    } catch (e: any) {
      console.error(`   ❌ Lỗi nạp từ [${item.word}]: ${e.message}`);
    }
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log(`📊 Tổng cộng đã nạp: ${totalInserted} thực thể ngôn ngữ vào PostgreSQL.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
