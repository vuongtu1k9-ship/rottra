/**
 * 🇻🇳 ROTTRA VIETNAMESE LEXICON MOOD SEED
 * Chạy: bun src/db/seed-moods.ts
 */
import { db } from "./db";
import { vietnameseLexicon } from "./schema";
import crypto from "crypto";

const MOOD_LEXICON_DATA = [
  {
    word: "vui vẻ",
    type: "tâm trạng",
    subType: "trạng thái tích cực",
    definition: "Trạng thái tâm lý vui tươi, phấn khởi, biểu hiện ra bên ngoài bằng nét mặt, nụ cười.",
    relations: ["phấn khởi", "hạnh phúc", "cười"],
  },
  {
    word: "buồn bã",
    type: "tâm trạng",
    subType: "trạng thái tiêu cực",
    definition: "Trạng thái tâm lý u sầu, đau lòng do gặp phải điều không như ý hoặc mất mát.",
    relations: ["u sầu", "khóc", "thất vọng"],
  },
  {
    word: "tức giận",
    type: "tâm trạng",
    subType: "trạng thái kích động",
    definition: "Trạng thái tâm lý bực tức, bất bình cao độ do bị xúc phạm, ngăn trở hoặc không vừa lòng.",
    relations: ["phẫn nộ", "nổi cáu", "bất bình"],
  },
  {
    word: "lo lắng",
    type: "tâm trạng",
    subType: "trạng thái bồn chồn",
    definition: "Trạng thái tâm lý bất an, bồn chồn vì sợ có điều không hay xảy ra.",
    relations: ["bất an", "sợ hãi", "suy nghĩ"],
  },
  {
    word: "hạnh phúc",
    type: "tâm trạng",
    subType: "trạng thái viên mãn",
    definition: "Trạng thái sung sướng cực độ vì cảm thấy hoàn toàn thỏa nguyện về mặt tinh thần.",
    relations: ["vui vẻ", "thỏa mãn", "an nhiên"],
  },
  {
    word: "sợ hãi",
    type: "tâm trạng",
    subType: "trạng thái hoảng hốt",
    definition: "Cảm giác e sợ, hoảng hốt trước mối đe dọa hoặc nguy hiểm sắp xảy ra.",
    relations: ["lo lắng", "trốn tránh", "hoảng loạn"],
  },
  {
    word: "phấn khích",
    type: "tâm trạng",
    subType: "trạng thái hào hứng",
    definition: "Trạng thái tâm lý bị kích thích mạnh mẽ, tràn đầy năng lượng và mong đợi.",
    relations: ["hào hứng", "sôi nổi", "năng động"],
  },
  {
    word: "chán nản",
    type: "tâm trạng",
    subType: "trạng thái mệt mỏi",
    definition: "Cảm giác oải, mất hết hứng thú, động lực và niềm tin vào công việc hoặc cuộc sống.",
    relations: ["oải", "buông xuôi", "thất vọng"],
  },
  {
    word: "tiếc nuối",
    type: "tâm trạng",
    subType: "trạng thái hoài niệm",
    definition: "Cảm giác tiếc thương, ân hận về những điều tốt đẹp đã qua hoặc cơ hội đã bỏ lỡ.",
    relations: ["hối tiếc", "ân hận", "hoài niệm"],
  },
  {
    word: "bình yên",
    type: "tâm trạng",
    subType: "trạng thái an nhiên",
    definition: "Trạng thái tinh thần thư thái, nhẹ nhõm, không bị xáo động bởi lo âu hay phiền muộn.",
    relations: ["an nhiên", "thư thái", "nhẹ nhõm"],
  },
  {
    word: "cô đơn",
    type: "tâm trạng",
    subType: "trạng thái đơn độc",
    definition: "Trạng thái tâm lý cảm thấy lẻ loi, đơn độc, thiếu sự kết nối hoặc chia sẻ với người khác.",
    relations: ["lẻ loi", "u sầu", "tự kỷ"],
  },
  {
    word: "ngạc nhiên",
    type: "tâm trạng",
    subType: "trạng thái bất ngờ",
    definition: "Trạng thái bất ngờ, ngỡ ngàng trước những điều mới lạ hoặc không lường trước được.",
    relations: ["bất ngờ", "ngỡ ngàng", "sửng sốt"],
  },
];

async function main() {
  console.log("🇻🇳 Bắt đầu nạp bổ sung các Từ chỉ Tâm trạng — Rotta Mood Lexicon");
  console.log("══════════════════════════════════════════════════════════");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const item of MOOD_LEXICON_DATA) {
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
        console.log(`   ✅ Đã nạp thành công từ tâm trạng: "${item.word}"`);
        totalInserted++;
      } else {
        console.log(`   ⏭️ Bỏ qua từ đã tồn tại: "${item.word}"`);
        totalSkipped++;
      }
    } catch (e: any) {
      console.error(`   ❌ Lỗi nạp từ [${item.word}]: ${e.message}`);
    }
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log(`📊 Hoàn thành: Đã thêm ${totalInserted} từ chỉ tâm trạng mới, bỏ qua ${totalSkipped} từ trùng lặp.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
