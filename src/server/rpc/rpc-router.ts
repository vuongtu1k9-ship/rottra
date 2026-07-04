import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { strategyPreset, vietnameseLexicon, bilingualCorpus } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const rpcApp = new Hono()
  .get("/products", async (c) => c.json({ products: (await db.query.product.findMany()) ?? [], status: "success" }))
  .post("/echo", async (c) => {
    const { message } = await c.req.json<{ message?: string }>().catch(() => ({ message: "" }));
    return c.json({ reply: `Server Rottra đã nhận: ${message ?? ""}`, serverTime: new Date().toISOString() });
  })
  .get("/force-migrate", async (c) => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "StrategyPreset" (
          "id" text PRIMARY KEY NOT NULL,
          "userId" text NOT NULL,
          "name" text NOT NULL,
          "description" text,
          "values" jsonb NOT NULL,
          "dimensions" jsonb NOT NULL,
          "addAt" timestamp with time zone DEFAULT now()
        );
      `);
      try {
        await db.execute(sql`
          ALTER TABLE "StrategyPreset" ADD COLUMN "category" varchar(150) DEFAULT 'Tùy chỉnh cá nhân';
        `);
      } catch (_) {
        // Ignore if column already exists
      }

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "VietnameseLexicon" (
          "id" text PRIMARY KEY NOT NULL,
          "word" text NOT NULL UNIQUE,
          "type" varchar(50) NOT NULL,
          "subType" varchar(100),
          "definition" text,
          "relations" jsonb,
          "addAt" timestamp with time zone DEFAULT now()
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "RlQTable" (
          "id" text PRIMARY KEY NOT NULL,
          "stateHash" text NOT NULL,
          "actionId" text NOT NULL,
          "qValue" real DEFAULT 0 NOT NULL,
          "visitCount" integer DEFAULT 0 NOT NULL,
          "lastUpdated" timestamp with time zone DEFAULT now()
        );
      `);
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rl_qtable_state ON "RlQTable" ("stateHash");`);
      } catch (e) {}

      // 🇻🇳 SEED ADVANCED VIETNAMESE GRAMMAR LEXICON
      const advancedLexicons = [
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
          definition:
            "Từ dùng để liên kết các thành phần câu hoặc các câu với nhau, biểu thị quan hệ ngữ nghĩa. Ví dụ: và, nhưng, vì, nếu.",
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
          subType: "biểu thị thái độ, sắc thái câu nói",
          definition:
            "Từ được thêm vào câu để cấu tạo câu nghi vấn, câu cầu khiến, câu cảm thán hoặc biểu thị thái độ. Ví dụ: à, nhé, cơ, thôi.",
          relations: ["à", "nhé", "cơ", "thôi"],
        },
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
          definition:
            "Từ có một nghĩa gốc và một hoặc nhiều nghĩa chuyển dựa trên mối liên hệ tương đồng hoặc tiếp cận. Ví dụ: 'chân' (chân người, chân bàn).",
          relations: ["chân", "chân người", "chân bàn"],
        },
        {
          word: "từ đồng âm",
          type: "ngữ nghĩa",
          subType: "phát âm giống nhau nhưng nghĩa khác nhau",
          definition:
            "Những từ trùng nhau về hình thức ngữ âm nhưng hoàn toàn khác nhau về mặt ngữ nghĩa. Ví dụ: 'đường' (con đường / đường ăn).",
          relations: ["đường", "con đường", "đường ăn"],
        },
        {
          word: "chủ ngữ",
          type: "thành phần câu",
          subType: "người/vật thực hiện hành động hoặc được nói đến",
          definition:
            "Thành phần chính của câu, chỉ chủ thể của hoạt động, đặc điểm, trạng thái nêu ở vị ngữ. Trả lời câu hỏi: Ai?, Cái gì?, Con gì?.",
          relations: ["Lan", "vị ngữ", "trạng ngữ"],
        },
        {
          word: "vị ngữ",
          type: "thành phần câu",
          subType: "nói về hoạt động, đặc điểm, trạng thái của chủ ngữ",
          definition:
            "Thành phần chính của câu, biểu thị hoạt động, trạng thái, đặc điểm của chủ thể nêu ở chủ ngữ. Trả lời câu hỏi: Làm gì?, Thế nào?, Là gì?.",
          relations: ["học bài", "chủ ngữ", "trạng ngữ"],
        },
        {
          word: "trạng ngữ",
          type: "thành phần câu",
          subType: "chỉ thời gian, nơi chốn, nguyên nhân...",
          definition: "Thành phần phụ của câu, bổ sung ý nghĩa tình thái về thời gian, địa điểm, phương tiện, cách thức cho nòng cốt câu.",
          relations: ["hôm nay", "chủ ngữ", "vị ngữ"],
        },
        {
          word: "em",
          type: "danh từ",
          subType: "chỉ người/xưng hô",
          definition: "Từ chỉ người em hoặc dùng làm đại từ xưng hô thân mật.",
          relations: ["em", "danh từ", "đại từ"],
        },
        {
          word: "đang",
          type: "phó từ",
          subType: "chỉ sự tiếp diễn",
          definition: "Phó từ chỉ hoạt động, trạng thái đang diễn ra trong hiện tại.",
          relations: ["đang", "phó từ"],
        },
        {
          word: "học",
          type: "động từ",
          subType: "chỉ hoạt động",
          definition: "Hành động tiếp thu kiến thức, rèn luyện kỹ năng dưới sự chỉ dẫn hoặc tự tìm tòi.",
          relations: ["học", "động từ"],
        },
        {
          word: "rất",
          type: "phó từ",
          subType: "chỉ mức độ",
          definition: "Phó từ biểu thị mức độ cao của tính chất, đặc điểm.",
          relations: ["rất", "phó từ"],
        },
        {
          word: "chăm chỉ",
          type: "tính từ",
          subType: "chỉ đặc điểm",
          definition: "Đặc điểm làm việc một cách liên tục, siêng năng và có trách nhiệm.",
          relations: ["chăm chỉ", "tính từ", "siêng năng"],
        },
        {
          word: "siêng năng",
          type: "tính từ",
          subType: "chỉ đặc điểm",
          definition: "Đặc điểm chăm chỉ, cần cù chịu khó làm việc hoặc học tập.",
          relations: ["siêng năng", "tính từ", "chăm chỉ"],
        },
        {
          word: "lan",
          type: "danh từ",
          subType: "tên riêng",
          definition: "Tên người riêng, thường đóng vai trò chủ ngữ.",
          relations: ["Lan", "chủ ngữ"],
        },
        {
          word: "học bài",
          type: "động từ",
          subType: "hoạt động cụm",
          definition: "Hành động ôn tập kiến thức, đọc sách chuẩn bị cho bài học.",
          relations: ["học bài", "vị ngữ"],
        },
        {
          word: "hôm nay",
          type: "danh từ",
          subType: "thời gian",
          definition: "Danh từ chỉ ngày hiện tại, thường đóng vai trò trạng ngữ chỉ thời gian.",
          relations: ["hôm nay", "trạng ngữ"],
        },
      ];

      let totalSeed = 0;
      for (const item of advancedLexicons) {
        const existing = await db.query.vietnameseLexicon.findFirst({
          where: (l: any, { eq }: any) => eq(l.word, item.word),
        });
        if (!existing) {
          await db.insert(vietnameseLexicon).values({
            id: "lex_" + uuidv4().split("-")[0].toUpperCase(),
            word: item.word,
            type: item.type,
            subType: item.subType,
            definition: item.definition,
            relations: item.relations,
            addAt: new Date().toISOString(),
          });
          totalSeed++;
        }
      }

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "BilingualCorpus" (
          "id" text PRIMARY KEY NOT NULL,
          "vi" text NOT NULL,
          "en" text,
          "zh" text,
          "ja" text,
          "fi" text,
          "he" text,
          "addAt" timestamp with time zone DEFAULT now()
        );
      `);

      // Ensure all 6 columns exist
      const columnsToAdd = ["vi", "en", "zh", "ja", "fi", "he"];
      for (const col of columnsToAdd) {
        try {
          await db.execute(sql`
            ALTER TABLE "BilingualCorpus" ADD COLUMN ${sql.raw(`"${col}"`)} text;
          `);
        } catch (_) {}
      }

      let totalCorpusSeed = 0;
      const multiLingualSeeds = [
        {
          vi: "Trợ lý RottraAI đang tối ưu hóa hệ thống chuỗi cung ứng nông nghiệp.",
          en: "RottraAI assistant is optimizing the agricultural supply chain system.",
          zh: "RottraAI 助手正在优化农业供应链系统。",
          ja: "RottraAIアシスタントは農業サプライチェーンシステムを最適化しています。",
          fi: "RottraAI-assistentti optimoi maatalouden toimitusketjujärjestelmää.",
          he: "עוזר RottraAI מבצע אופטימיזציה למערכת שרשרת האספקה ​​החקלאית.",
        },
        {
          vi: "Định lý bốn màu giúp phân hoạch bản đồ logistics không bị xung đột.",
          en: "The four color theorem helps partition the logistics map without conflicts.",
          zh: "四色定理有助于划分物流地图而不会产生冲突。",
          ja: "四色定理は衝突なしに物流マップを分割するのに役立ちます。",
          fi: "Neljän värin lause auttaa jakamaan logistiikkakartan ilman konflikteja.",
          he: "משפט ארבעת הצבעים עוזר לחלק את מפת הלוגיסטיקה ללא קונפליקטים.",
        },
        {
          vi: "Mạng nơ-ron truyền thẳng biến đổi đặc trưng thô thành dự đoán cuối cùng.",
          en: "Feedforward neural network transforms raw features into the final prediction.",
          zh: "前馈神经网络将原始特征转化为最终预测。",
          ja: "順伝播型ニュータルネットワークは生の特徴を最終的な予測に変換します。",
          fi: "Myötäkytketty neuroverkko muuntaa raa'at ominaisuudet lopulliseksi ennusteeksi.",
          he: "רשת עצבית מזינה קדימה משנה מאפיינים גולמיים לחיזוי הסופי.",
        },
        {
          vi: "Bộ lọc Kalman giảm thiểu nhiễu cảm biến trong các thiết bị IoT nông nghiệp.",
          en: "The Kalman filter minimizes sensor noise in agricultural IoT devices.",
          zh: "卡尔曼滤波器减少了农业物联网设备中的传感器噪声。",
          ja: "カルマンフィルターは農業用IoTデバイスのセンサーノイズを最小限に抑えます。",
          fi: "Kalman-suodatin minimoi anturikohinan maatalouden IoT-laitteissa.",
          he: "מסנן קלמן ממזער את רעש החיישנים במכשירי IoT חקלאיים.",
        },
        {
          vi: "Lượng hóa Johnson-Lindenstrauss giảm số chiều của các vector embedding.",
          en: "Johnson-Lindenstrauss quantization reduces the dimensionality of embedding vectors.",
          zh: "Johnson-Lindenstrauss 量化减少了嵌入向量的维度。",
          ja: "Johnson-Lindenstrauss 量子化は埋め込みベクトルの次元を削減します。",
          fi: "Johnson-Lindenstrauss-kvantisointi vähentää upotusvektorien ulotteisuutta.",
          he: "קוונטיזציה của Johnson-Lindenstrauss giảm số chiều của các vector embedding.",
        },
      ];

      for (let i = 0; i < multiLingualSeeds.length; i++) {
        const seed = multiLingualSeeds[i];
        await db
          .insert(bilingualCorpus)
          .values({
            id: `multi_seed_${i}`,
            vi: seed.vi,
            en: seed.en,
            zh: seed.zh,
            ja: seed.ja,
            fi: seed.fi,
            he: seed.he,
            addAt: new Date().toISOString(),
          })
          .onConflictDoNothing();
        totalCorpusSeed++;
      }

      let totalClassifiedLexicons = 0;
      const enPath = "/home/l/Downloads/archive/en_sents";
      const viPath = "/home/l/Downloads/archive/vi_sents";

      if (fs.existsSync(enPath) && fs.existsSync(viPath)) {
        const enLines = fs.readFileSync(enPath, "utf-8").split("\n");
        const viLines = fs.readFileSync(viPath, "utf-8").split("\n");

        // 1. Seed Bilingual Corpus
        const currentCountRes = await db.execute(sql`SELECT count(*) as count FROM "BilingualCorpus"`);
        const currentCount = Number((currentCountRes as any)[0]?.count || 0);

        if (currentCount < 2000) {
          const maxSeed = Math.min(2000, enLines.length, viLines.length);
          for (let i = 0; i < maxSeed; i++) {
            const enText = enLines[i]?.trim();
            const viText = viLines[i]?.trim();
            if (enText && viText) {
              await db
                .insert(bilingualCorpus)
                .values({
                  id: "bi_" + uuidv4().split("-")[0].toUpperCase() + `_${i}`,
                  vi: viText,
                  en: enText,
                  zh: "",
                  ja: "",
                  fi: "",
                  he: "",
                  addAt: new Date().toISOString(),
                })
                .onConflictDoNothing();
              totalCorpusSeed++;
            }
          }
        }

        // 2. DYNAMICALLY EXTRACT & CLASSIFY LEXICONS FROM THE CORPUS SENTENCES
        const wordFreqs = new Map<string, number>();
        const candidateLines = viLines.slice(0, 1000);
        for (const line of candidateLines) {
          if (!line) continue;
          const cleanLine = line
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
            .trim();
          const tokens = cleanLine.split(/\s+/).filter((t) => t.length > 0);

          for (let i = 0; i < tokens.length - 1; i++) {
            const bigram = `${tokens[i]} ${tokens[i + 1]}`;
            if (/^[a-zàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s]+$/i.test(bigram)) {
              wordFreqs.set(bigram, (wordFreqs.get(bigram) || 0) + 1);
            }
          }
        }

        const getInitialConsonant = (s: string) => {
          const match = s.match(/^(ch|tr|th|kh|ph|nh|gh|gi|ngh|ng|d|đ|b|c|g|h|l|m|n|r|s|t|v|x)/);
          return match ? match[0] : s.charAt(0);
        };

        const getRhyme = (s: string) => {
          return s.replace(/^(ch|tr|th|kh|ph|nh|gh|gi|ngh|ng|d|đ|b|c|g|h|l|m|n|r|s|t|v|x)/, "");
        };

        const sortedBigrams = [...wordFreqs.entries()].filter(([_, freq]) => freq >= 2).sort((a, b) => b[1] - a[1]);

        const commonConnectors = new Set([
          "và",
          "nhưng",
          "hoặc",
          "của",
          "cho",
          "thì",
          "là",
          "mà",
          "có",
          "được",
          "bị",
          "bởi",
          "trong",
          "ngoài",
          "trên",
          "dưới",
          "những",
          "các",
          "một",
          "hai",
          "này",
          "kia",
        ]);

        for (const [bigram, freq] of sortedBigrams.slice(0, 150)) {
          const parts = bigram.split(" ");
          if (parts.length !== 2) continue;
          const [p1, p2] = parts;
          if (p1.length < 2 || p2.length < 2) continue;

          let type = "compound";
          let subType = "Từ ghép chính phụ / đẳng lập";
          let definition = `Từ ghép ngữ nghĩa độc lập kết hợp giữa '${p1}' và '${p2}', biểu thị một khái niệm phức hợp thực tế từ ngữ liệu song ngữ.`;

          // Detect Reduplicative (Từ láy)
          let isRedup = false;
          if (p1 === p2) {
            isRedup = true;
            type = "reduplicative";
            subType = "Láy toàn bộ";
            definition = `Từ láy toàn bộ cấu tạo bởi hai tiếng '${p1}' lặp lại hoàn toàn để nhấn mạnh sắc thái ý nghĩa hoặc âm điệu.`;
          } else {
            const c1 = getInitialConsonant(p1);
            const c2 = getInitialConsonant(p2);
            const r1 = getRhyme(p1);
            const r2 = getRhyme(p2);

            if (c1 && c1 === c2 && r1 !== r2) {
              isRedup = true;
              type = "reduplicative";
              subType = "Láy phụ âm đầu";
              definition = `Từ láy phụ âm đầu '${c1.toUpperCase()}' kết nối sinh động hai tiếng '${p1}' và '${p2}'.`;
            } else if (r1 && r1 === r2 && c1 !== c2) {
              isRedup = true;
              type = "reduplicative";
              subType = "Láy vần";
              definition = `Từ láy phối hợp âm điệu vần '${r1}' giữa hai tiếng '${p1}' và '${p2}' gợi tả nhịp điệu uyển chuyển.`;
            }
          }

          if (!isRedup && (commonConnectors.has(p1) || commonConnectors.has(p2))) {
            continue;
          }

          const existing = await db.query.vietnameseLexicon.findFirst({
            where: (l: any, { eq }: any) => eq(l.word, bigram),
          });
          if (!existing) {
            await db.insert(vietnameseLexicon).values({
              id: "lex_" + uuidv4().split("-")[0].toUpperCase() + `_${totalClassifiedLexicons}`,
              word: bigram,
              type: type,
              subType: subType,
              definition: definition,
              relations: [p1, p2, "phân loại tự động", "ngữ liệu thực tế"],
              addAt: new Date().toISOString(),
            });
            totalClassifiedLexicons++;
          }
        }
      }

      return c.json({
        status: "success",
        message: `Tạo và đồng bộ bảng thành công! Đã nạp thêm ${totalSeed} thực thể ngôn ngữ nâng cao, phân loại tự động ${totalClassifiedLexicons} từ láy/từ ghép mới từ ngữ liệu, và đồng bộ ${totalCorpusSeed} câu song ngữ Anh-Việt.`,
      });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .get("/strategy-presets", async (c) => {
    try {
      const presets = (await db.query.strategyPreset.findMany({ orderBy: (p: any, { desc }: any) => [desc(p.addAt)] })) ?? [];
      return c.json({ status: "success", presets });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/strategy-presets", async (c) => {
    try {
      const body = (await c.req
        .json<{ name?: string; description?: string; values?: number[]; dimensions?: string[] }>()
        .catch(() => ({}))) as any;
      const newId = uuidv4();
      await db.insert(strategyPreset).values({
        id: newId,
        userId: "local-user-1",
        name: body?.name ?? "Không tên",
        description: body?.description ?? "",
        values: body?.values ?? [],
        dimensions: body?.dimensions ?? [],
        addAt: new Date().toISOString(),
      });
      return c.json({ status: "success", id: newId });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .delete("/strategy-presets/:id", async (c) => {
    try {
      await db.delete(strategyPreset).where(eq(strategyPreset.id, c.req.param("id")));
      return c.json({ status: "success", message: "Đã xóa hình mẫu thành công!" });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/agent-analyze-radar", async (c) => {
    try {
      const { mainPresetId, comparePresetId, customData } = (await c.req
        .json<{
          mainPresetId?: string;
          comparePresetId?: string;
          customData?: { name: string; values: number[]; dimensions: string[] };
        }>()
        .catch(() => ({}))) as any;

      let mainPreset: any = null;
      if (mainPresetId === "custom" && customData) {
        mainPreset = {
          name: customData.name,
          values: customData.values,
          dimensions: customData.dimensions,
        };
      } else {
        if (!mainPresetId) return c.json({ status: "error", error: "Missing preset ID" }, 400);
        mainPreset = await db.query.strategyPreset.findFirst({ where: eq(strategyPreset.id, mainPresetId) });
      }

      if (!mainPreset) return c.json({ status: "error", error: "Main preset not found" }, 404);

      let markdown = `### 🤖 Phân Tích Chiến Lược AI: **${mainPreset.name}**\n\n*Báo cáo được tổng hợp tự động bởi hệ thống Rottra Heuristic Agent.*\n\n`;

      if (!comparePresetId || comparePresetId === "none") {
        markdown += `Mô hình **${mainPreset.name}** được tinh chỉnh tập trung vào các đặc tính chuyên biệt. Hệ số cao nhất đạt ${Math.max(...((mainPreset.values as number[]) ?? [0]))}/10.\n\n**💡 Khuyến nghị:** Hãy sử dụng mô hình này cho các tác vụ cần tối ưu hóa các điểm mạnh kể trên.`;
      } else {
        const comparePreset = await db.query.strategyPreset.findFirst({ where: eq(strategyPreset.id, comparePresetId) });
        if (comparePreset) {
          markdown += `Đang so sánh đối trọng trực tiếp với **${comparePreset.name}**.\n\n`;

          const dimensions = (mainPreset.dimensions as string[]) ?? [];
          const mValues = (mainPreset.values as number[]) ?? [];
          const cValues = (comparePreset.values as number[]) ?? [];

          const strengths = dimensions.reduce((acc: string[], dim, i) => {
            const diff = (mValues[i] ?? 0) - (cValues[i] ?? 0);
            return diff > 0 ? [...acc, `- **${dim}**: +${diff.toFixed(1)} điểm vượt trội.`] : acc;
          }, []);

          const weaknesses = dimensions.reduce((acc: string[], dim, i) => {
            const diff = (mValues[i] ?? 0) - (cValues[i] ?? 0);
            return diff < 0 ? [...acc, `- **${dim}**: Thấp hơn ${Math.abs(diff).toFixed(1)} điểm.`] : acc;
          }, []);

          markdown += `#### 🟢 Ưu Điểm Tuyệt Đối\n${strengths.length > 0 ? strengths.join("\n") : "Không có ưu điểm nào vượt trội hoàn toàn so với đối thủ."}\n\n`;
          markdown += `#### 🔴 Điểm Cần Cải Thiện\n${weaknesses.length > 0 ? weaknesses.join("\n") : "Hoàn toàn áp đảo đối thủ trên mọi phương diện!"}\n\n`;
          markdown += `#### 🎯 Kết Luận\n${strengths.length > weaknesses.length ? `**${mainPreset.name}** là sự lựa chọn ưu việt hơn trong tác vụ tổng hợp. Tuy nhiên, hãy lưu ý các điểm yếu nhỏ lẻ để có chiến lược bù đắp phù hợp.` : `**${comparePreset.name}** đang cho thấy ưu thế nhỉnh hơn. Nếu bạn vẫn muốn sử dụng **${mainPreset.name}**, hãy thiết kế các Prompt đặc tả cực kỳ chi tiết để khắc phục điểm yếu.`}`;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      return c.json({ status: "success", markdown });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .get("/lexicons", async (c) => {
    try {
      const list = (await db.query.vietnameseLexicon.findMany({ orderBy: (l: any, { desc }: any) => [desc(l.addAt)] })) ?? [];
      return c.json({ status: "success", lexicons: list });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/lexicons", async (c) => {
    try {
      const body = await c.req
        .json<{
          id?: string;
          word: string;
          type: string;
          subType?: string;
          definition?: string;
          relations?: string[];
        }>()
        .catch(() => ({}) as any);

      if (!body.word || !body.type) {
        return c.json({ status: "error", error: "Thiếu từ khóa hoặc phân loại từ!" }, 400);
      }

      const cleanWord = body.word.trim();
      const cleanType = body.type.trim();

      if (body.id) {
        await db
          .update(vietnameseLexicon)
          .set({
            word: cleanWord,
            type: cleanType,
            subType: body.subType?.trim() || null,
            definition: body.definition?.trim() || null,
            relations: body.relations || [],
          })
          .where(eq(vietnameseLexicon.id, body.id));
        return c.json({ status: "success", message: "Đã cập nhật từ khóa thành công!" });
      } else {
        const newId = "lex_" + uuidv4().split("-")[0].toUpperCase();
        await db.insert(vietnameseLexicon).values({
          id: newId,
          word: cleanWord,
          type: cleanType,
          subType: body.subType?.trim() || null,
          definition: body.definition?.trim() || null,
          relations: body.relations || [],
          addAt: new Date().toISOString(),
        });
        return c.json({ status: "success", message: "Đã thêm từ khóa mới thành công!", id: newId });
      }
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .delete("/lexicons/:id", async (c) => {
    try {
      await db.delete(vietnameseLexicon).where(eq(vietnameseLexicon.id, c.req.param("id")));
      return c.json({ status: "success", message: "Đã xóa từ khóa thành công!" });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/bilingual-corpus/search", async (c) => {
    try {
      const body = (await c.req.json<{ search?: string; limit?: number; page?: number }>().catch(() => ({}))) as any;
      const queryStr = body.search || "";
      const limitVal = Math.min(Number(body.limit || 50), 200);
      const pageVal = Math.max(Number(body.page || 1), 1);
      const offsetVal = (pageVal - 1) * limitVal;

      if (queryStr.trim()) {
        const searchLower = `%${queryStr.toLowerCase()}%`;
        const list = await db.execute(sql`
          SELECT * FROM "BilingualCorpus"
          WHERE LOWER(vi) LIKE ${searchLower}
             OR LOWER(en) LIKE ${searchLower}
             OR LOWER(zh) LIKE ${searchLower}
             OR LOWER(ja) LIKE ${searchLower}
             OR LOWER(fi) LIKE ${searchLower}
             OR LOWER(he) LIKE ${searchLower}
          ORDER BY "addAt" DESC
          LIMIT ${limitVal}
          OFFSET ${offsetVal}
        `);

        const countRes = await db.execute(sql`
          SELECT count(*) as count FROM "BilingualCorpus"
          WHERE LOWER(vi) LIKE ${searchLower}
             OR LOWER(en) LIKE ${searchLower}
             OR LOWER(zh) LIKE ${searchLower}
             OR LOWER(ja) LIKE ${searchLower}
             OR LOWER(fi) LIKE ${searchLower}
             OR LOWER(he) LIKE ${searchLower}
        `);
        const total = Number((countRes as any)[0]?.count || 0);

        if (list.length === 0) {
          const enPath = "/home/l/Downloads/archive/en_sents";
          const viPath = "/home/l/Downloads/archive/vi_sents";
          const results: any[] = [];

          if (fs.existsSync(enPath) && fs.existsSync(viPath)) {
            const enLines = fs.readFileSync(enPath, "utf-8").split("\n");
            const viLines = fs.readFileSync(viPath, "utf-8").split("\n");

            for (let i = 0; i < enLines.length; i++) {
              const en = enLines[i] || "";
              const vi = viLines[i] || "";
              if (en.toLowerCase().includes(queryStr.toLowerCase()) || vi.toLowerCase().includes(queryStr.toLowerCase())) {
                results.push({ id: `file_${i}`, vi, en, zh: "", ja: "", fi: "", he: "" });
                if (results.length >= offsetVal + limitVal + 200) {
                  break;
                }
              }
            }
          }
          return c.json({
            status: "success",
            corpus: results.slice(offsetVal, offsetVal + limitVal),
            total: results.length,
            source: "all_254k_parallel_corpus",
          });
        }

        return c.json({
          status: "success",
          corpus: list,
          total: total,
          source: "seeded_db_search",
        });
      } else {
        const list =
          (await db.query.bilingualCorpus.findMany({
            limit: limitVal,
            offset: offsetVal,
            orderBy: (b: any, { desc }: any) => [desc(b.addAt)],
          })) ?? [];

        return c.json({
          status: "success",
          corpus: list,
          total: 2005,
          source: "seeded_db",
        });
      }
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/rl/reward", async (c) => {
    try {
      const { stateHash, actionId, reward } = await c.req.json<{ stateHash: string; actionId: string; reward: number }>();
      const { updateQValue } = await import("~/server/api/rl-engine");
      await updateQValue(stateHash, actionId, reward);
      return c.json({ status: "success" });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  })
  .post("/rl/recommend", async (c) => {
    try {
      const { context } = await c.req.json<{ context: any }>();
      const products = await db.query.product.findMany({ limit: 20 });
      const { recommendProduct, hashState } = await import("~/server/api/rl-engine");
      const recommended = await recommendProduct(context, products);
      return c.json({ status: "success", stateHash: hashState(context), product: recommended });
    } catch (e) {
      return c.json({ status: "error", error: String(e) }, 500);
    }
  });

export type RpcAppType = typeof rpcApp;
export default rpcApp;
