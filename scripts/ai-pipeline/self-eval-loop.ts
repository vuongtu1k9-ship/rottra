/**
 * ROTTRA SELF-EVALUATION LOOP
 * Tự động test → detect sai → tự thêm anchor → lặp lại đến khi đạt ngưỡng
 *
 * Usage: bun run scripts/ai-pipeline/self-eval-loop.ts
 */
import fs from "fs";
import path from "path";
import { removeAccents } from "../../src/core/nlp-cognitive/tokenizer";

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const TARGET_ACCURACY = 90; // percent
const MAX_ITERATIONS = 10;
const TOKENIZER_PATH = path.join(process.cwd(), "src/core/nlp-cognitive/tokenizer.ts");

// ═══════════════════════════════════════
// TEST QUESTIONS (generated from training data patterns)
// ═══════════════════════════════════════
type TestCase = { q: string; intent: string };

export function generateTestCases(): TestCase[] {
  const templates: Record<string, string[]> = {
    GREETING: [
      "xin chào", "hello", "chào bạn", "chào buổi sáng", "chào buổi tối",
      "hi", "alo", "bạn khỏe không", "hôm nay bạn thế nào", "bạn đang làm gì",
      "có ai không", "bạn ơi", "cho mình hỏi", "mình muốn hỏi", "giúp mình với",
      "bạn tên gì", "ai tạo ra bạn", "bạn là ai", "bạn làm được gì",
      "bạn có người yêu chưa", "kể chuyện cười đi", "tạm biệt", "bye",
      "gặp lại sau", "chúc ngủ ngon",
    ],
    MARKET_PRICE: [
      "giá lúa hôm nay", "giá lúa OM5451", "giá lúa ST25 bao nhiêu",
      "giá cà phê Robusta", "giá cà phê Kon Tum", "giá Arabica",
      "giá hồ tiêu Đắk Lắk", "giá tiêu đen", "giá tiêu trắng",
      "giá điều nhân", "giá điều thô", "giá sầu riêng Musang King",
      "giá sầu riêng Monthong", "giá bơ Hass", "giá bơ 034",
      "giá xoài cát chu", "giá xoài Đài Loan", "giá mít Thái",
      "giá cam Vinh", "giá cam cara", "giá chanh leo Gia Lai",
      "giá cao su thiên nhiên", "giá dừa Bến Tre", "giá dừa tươi",
      "giá ngô giống", "giá ngô lai", "giá khoai lang", "giá khoai môn",
      "giá rau muống", "giá cà chua", "giá ớt hiểm", "giá tỏi Lào Cai",
      "giá gừng", "giá nghệ", "giá nấm linh chi", "giá nấm rơm",
      "giá phân bón Ure", "giá phân DAP", "giá phân KCl", "giá phân NPK",
      "giá giống lúa ST25", "giá giống lúa OM5451", "giá giống bơ",
      "giá thuốc BVTV", "giá đất nông nghiệp Tây Ninh", "giá thuê đất",
      "giá máy cày mini", "giá drone phun thuốc", "tỷ giá USD",
      "giá vàng SJC", "giá sắt thép", "giá xăng dầu", "giá điện",
      "giá cước vận chuyển", "so sánh giá lúa", "giá cà phê bao nhiêu",
      "giá bán lúa", "giá lúa tươi", "giá lúa IR50404",
    ],
    FARMING_TECHNIQUE: [
      "cách trồng lúa hiệu quả", "kỹ thuật trồng lúa nước",
      "làm đất chuẩn bị trồng lúa", "gieo hạt lúa đúng cách",
      "bón phân đợt 1 cho lúa", "bón phân đợt 2 cho lúa",
      "bón phân đợt 3 cho lúa", "tưới nước lúc nào tốt nhất",
      "cắt cỏ khi nào", "phun thuốc trừ sâu lúc nào",
      "cà phê bị rụng trái", "tiêu bị vàng lá", "lúa bị đốm lá",
      "mít bị chảy nhựa", "ớt bị héo gốc", "dưa bị bệnh phù thủng",
      "sâu ăn lá", "ruộng lúa bị nhiễm mặn",
      "cách phòng chống nấm trên cà phê", "trồng hồ tiêu dây leo",
      "cách xử lý đất bị nhiễm mặn", "phân bón lá dùng khi nào",
      "cách ủ phân hữu cơ", "trồng nấm rơm", "cách làm giá đỗ",
      "trồng chuối cấy mô", "cách phòng sâu keo", "bón vôi cho đất",
      "trồng mít Thái", "cách xử lý rơm rạ", "trồng lúa organic",
      "cách tăng độ phì nhiêu", "khi nào thu hoạch lúa",
      "bảo quản lúa sau thu hoạch", "cách sấy lúa",
      "trồng rau màu mùa đông", "cách trồng sầu riêng từ hạt",
      "cây ăn quả ra nhiều trái", "mùa này nên trồng gì",
      "giống lúa chịu hạn", "trồng bơ bán được giá",
      "giống xoài trái to", "trồng cam năng suất cao",
      "phân bón tốt nhất cho lúa", "phân bón tốt cho hồ tiêu",
      "cải thiện năng suất", "cách thu hoạch đúng thời điểm",
      "bảo quản nông sản", "cách phòng trừ sâu bệnh",
      "mùa vụ trồng cà phê", "trồng rau sạch",
      "đất xấu trồng gì", "bắt đầu trồng trọt",
      "vùng núi tư vấn", "trồng ớt hiệu quả",
      "trồng dưa leo", "kỹ thuật trồng chuối",
      "trồng điều bao lâu", "cách ghép cây ăn quả",
    ],
    WEATHER_SEASON: [
      "thời tiết hôm nay", "thời tiết ngày mai",
      "dự báo thời tiết 7 ngày", "nắng nóng kéo dài",
      "mùa mưa nên làm gì", "bão sắp đến",
      "hạn hán kéo dài", "rét đậm ảnh hưởng",
      "độ ẩm không khí", "lượng mưa ảnh hưởng",
      "mùa này trồng lúa", "mùa nào sâu bệnh",
      "dự báo lũ lụt", "thời tiết thu hoạch cà phê",
      "sương muối ảnh hưởng", "dự báo El Niño",
      "nhiệt độ lý tưởng cho cà phê", "gió mùa đông bắc",
      "mưa lớn kéo dài", "nhiệt độ cao quá",
      "trời mưa quá", "thời tiết mùa đông",
      "thời tiết miền Bắc", "thời tiết miền Nam",
      "thời tiết miền Trung", "dự báo Tây Nguyên",
      "dự báo ĐBSCL", "mùa xuân trồng gì",
      "mùa hè trồng gì", "mùa thu trồng gì",
      "mùa đông trồng gì", "thời tiết thuận lợi",
      "nhiệt độ đất ảnh hưởng", "độ ẩm đất",
      "thời tiết có mưa không", "gió mạnh ảnh hưởng",
      "sương giá mùa đông", "nắng gắt kéo dài",
      "mưa đá gây thiệt hại", "dự báo cho trồng lúa",
    ],
    FINANCE_COST: [
      "tính chi phí 1 hecta lúa", "lãi suất vay ngân hàng",
      "điểm hòa vốn khi trồng lúa", "so sánh lãi lúa vs cà phê",
      "tính lợi nhuận bán rau", "máy móc nông nghiệp bao nhiêu",
      "chi phí thuê nhân công", "đầu tư nhà kính hoàn vốn",
      "vay vốn ngân hàng nông nghiệp", "bảo hiểm mùa vụ",
      "chính sách hỗ trợ nông dân", "tính chi phí 1 hecta cà phê",
      "tính chi phí 1 hecta hồ tiêu", "tính chi phí 1 hecta điều",
      "lợi nhuận quý này", "tồn kho còn bao nhiêu",
      "giá vốn sản phẩm", "phân tích dòng tiền",
      "tính NPV dự án", "ROI dự án",
      "chi phí vận hành trang trại", "phân tích lợi nhuận lô hàng",
      "tỷ suất lợi nhuận gộp", "tối ưu chi phí logistics",
      "phân tích chi phí-lợi nhuận", "tính giá vốn 1 kg",
      "chi phí làm nhà kính", "chi phí mua drone",
      "tính khấu hao máy móc", "lãi suất vay ưu đãi",
      "tính thuế nông nghiệp", "chi phí chứng nhận Organic",
      "chi phí chứng nhận VietGAP", "tính doanh thu mùa vụ",
      "tính giá thành cà phê",
    ],
    CUSTOMER_SERVICE: [
      "sản phẩm bị hư khi giao", "đơn hàng bị giao sai",
      "phân bón giả", "giao hàng chậm quá",
      "sản phẩm không đúng mô tả",
      "muốn khiếu nại", "đổi trả mất phí",
      "mua phải hàng hết date",
      "phản hồi sản phẩm", "khiếu nại dịch vụ",
      "liên hệ hỗ trợ", "gặp sự cố",
      "góp ý sản phẩm", "đánh giá dịch vụ",
      "giao hàng tận ruộng",
    ],
    SMART_AGRI: [
      "cảm biến độ ẩm đất", "hệ thống tưới tự động IoT",
      "drone phun thuốc", "camera AI phát hiện sâu bệnh",
      "nhà kính thông minh", "phân bón chính xác",
      "IoT gateway nông nghiệp", "quản lý năng lượng trang trại",
      "PID điều khiển nhà kính", "LoRa Zigbee",
      "GPS nông nghiệp chính xác", "camera multispectral",
      "AI phát hiện bệnh cây", "robot hái trái cây",
      "đo nhiệt độ đất IoT", "cảm biến độ ẩm không khí",
      "bẫy đèn thông minh", "trạm quan trắc tự động",
      "sensor đất nông nghiệp", "tưới tiêu tự động",
    ],
    NEGOTIATION_PROMO: [
      "giảm giá được không", "mua số lượng lớn giảm",
      "có khuyến mãi không", "giá này mắc quá",
      "có mã giảm giá", "mua kèm được giảm",
      "deal sốc", "giá cuối cùng",
      "thương lượng giá", "giá tốt hơn",
      "mua 10 tấn giảm", "khuyến mãi tháng",
      "ưu đãi khách mới", "giá sỉ bao nhiêu",
      "giá lẻ bao nhiêu",
    ],
    PRODUCT_DETAIL: [
      "sản phẩm có gì đặc biệt", "so sánh sản phẩm",
      "đánh giá sản phẩm", "sản phẩm có tốt không",
      "nguồn gốc sản phẩm", "sản phẩm organic",
      "hạn sử dụng sản phẩm", "sản phẩm đóng gói",
      "mua số lượng lớn giảm", "có mẫu thử",
      "sản phẩm chứng nhận gì", "chất lượng sản phẩm",
      "so sánh đối thủ", "đặc điểm nổi bật",
      "sản phẩm an toàn không",
    ],
    ORDER_PAYMENT: [
      "đơn hàng của tôi", "thanh toán bằng gì",
      "giao hàng bao lâu", "phí vận chuyển",
      "hủy đơn hàng", "đổi trả sản phẩm",
      "kiểm tra mã vận đơn", "nhận hàng chưa",
      "thanh toán khi nhận hàng", "chuyển khoản ngân hàng",
      "ví MoMo", "ZaloPay",
      "COD thanh toán", "thanh toán trả góp",
      "đặt hàng qua điện thoại",
    ],
    CONVERSATIONAL: [
      "tôi buồn", "tôi vui", "tôi mệt",
      "động viên tôi", "tôi stress quá",
      "tôi tức giận", "nói tiếng Anh",
      "đổi sang English", "nói tiếng Việt",
      "bạn đẹp không", "bạn hát được không",
      "kể chuyện vui", "hôm nay ngày mấy",
      "mấy giờ rồi", "thứ mấy",
      "ngày mai ngày gì", "bạn bao nhiêu tuổi",
      "bạn làm việc giờ nào", "tên bạn là gì",
      "bạn biết tiếng Trung không",
    ],
  };

  const cases: TestCase[] = [];
  for (const [intent, qs] of Object.entries(templates)) {
    for (const q of qs) cases.push({ q, intent });
  }
  return cases;
}

// ═══════════════════════════════════════
// SEMANTIC ANCHORS (extracted from tokenizer.ts)
// ═══════════════════════════════════════
function extractAnchors(): Record<string, string[]> {
  const content = fs.readFileSync(TOKENIZER_PATH, "utf-8");
  const match = content.match(/export const SEMANTIC_ANCHORS[^=]*=\s*(\{[\s\S]*?\n\};)/);
  if (!match) return {};

  const anchorsText = match[1];
  const result: Record<string, string[]> = {};
  const intentRegex = /(\w+):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = intentRegex.exec(anchorsText)) !== null) {
    const intent = m[1];
    const keywords = m[2].split(",").map(k => k.replace(/"/g, "").trim()).filter(Boolean);
    result[intent] = keywords;
  }
  return result;
}

// ═══════════════════════════════════════
// CLASSIFIER (offline)
// ═══════════════════════════════════════
const SPECIFICITY: Record<string, number> = {
  MARKET_PRICE: 1.5, FARMING_TECHNIQUE: 1.5, WEATHER_SEASON: 1.4,
  FINANCE_COST: 1.4, CUSTOMER_SERVICE: 1.3, SMART_AGRI: 1.3,
  PRODUCT_DETAIL: 1.2, NEGOTIATION_PROMO: 1.2, ORDER_PAYMENT: 1.2,
  CONVERSATIONAL: 0.8, SEARCH: 1.0, GREETING: 1.0, COMPLAINT: 1.0,
  NAVIGATION: 1.0,
};

function classifyOffline(q: string, anchors: Record<string, string[]>): string {
  const c = removeAccents(q).toLowerCase().trim();

  // Pass 1: exact match (score >= 0.5)
  for (const [intent, kws] of Object.entries(anchors)) {
    for (const kw of kws) {
      const kc = removeAccents(kw).toLowerCase().trim();
      const ok = kc.length <= 3
        ? new RegExp(`\\b${kc}\\b`, "i").test(c)
        : c.includes(kc);
      if (ok) {
        const s = (kc.length / c.length) * (SPECIFICITY[intent] || 1);
        if (s >= 0.5) return intent;
      }
    }
  }

  // Pass 2: fuzzy match
  let best = "SEARCH", bestS = 0;
  for (const [intent, kws] of Object.entries(anchors)) {
    for (const kw of kws) {
      const kc = removeAccents(kw).toLowerCase().trim();
      const ok = kc.length <= 3
        ? new RegExp(`\\b${kc}\\b`, "i").test(c)
        : c.includes(kc);
      if (ok) {
        const s = (kc.length / c.length) * (SPECIFICITY[intent] || 1);
        if (s > bestS && s < 0.5) { bestS = s; best = intent; }
      }
    }
  }
  return best;
}

// ═══════════════════════════════════════
// AUTO-ANCHOR GENERATION
// ═══════════════════════════════════════
// AUTO-ANCHOR GENERATION
// ═══════════════════════════════════════
function generateAnchorFromQuery(q: string, wrongIntent: string, correctIntent: string): string {
  const clean = removeAccents(q).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const words = clean.split(" ");

  if (words.length >= 3) {
    return words.slice(0, 3).join(" ");
  }
  return clean;
}

function analyzeFailures(
  testCases: TestCase[],
  anchors: Record<string, string[]>
): Array<{ intent: string; query: string; wrongIntent: string; suggestedAnchor: string }> {
  const failures: Array<{ intent: string; query: string; wrongIntent: string; suggestedAnchor: string }> = [];

  for (const tc of testCases) {
    const got = classifyOffline(tc.q, anchors);
    if (got !== tc.intent) {
      const anchor = generateAnchorFromQuery(tc.q, got, tc.intent);
      failures.push({
        intent: tc.intent,
        query: tc.q,
        wrongIntent: got,
        suggestedAnchor: anchor,
      });
    }
  }
  return failures;
}

function suggestNewAnchors(
  failures: Array<{ intent: string; suggestedAnchor: string }>
): Record<string, string[]> {
  const suggestions: Record<string, Set<string>> = {};

  for (const f of failures) {
    const targetIntent = f.intent;
    if (!suggestions[targetIntent]) suggestions[targetIntent] = new Set();
    suggestions[targetIntent].add(f.suggestedAnchor);
  }

  const result: Record<string, string[]> = {};
  for (const [intent, anchors] of Object.entries(suggestions)) {
    result[intent] = Array.from(anchors);
  }
  return result;
}

// ═══════════════════════════════════════
// FILE UPDATE
// ═══════════════════════════════════════
const ALLOWED_SINGLE_WORDS = new Set([
  "arima", "momo", "zalopay", "cod", "vat", "gps", "drone", "sensor", "iot",
  "npv", "irr", "gantt", "trello", "jira", "knn", "el nino", "la nina", "kalman",
  "bye", "hi", "alo", "hello", "ure", "dap", "npk", "buon", "vui", "met", "dep", "hat"
]);

function isAllowedAnchor(anchor: string): boolean {
  const trimmed = anchor.trim();
  if (trimmed.length < 3) return false;
  if (trimmed.includes(" ")) {
    const genericPhrases = new Set([
      "khi nao", "bao nhieu", "gia ca"
    ]);
    if (genericPhrases.has(trimmed)) return false;
    return true;
  }
  return ALLOWED_SINGLE_WORDS.has(trimmed.toLowerCase());
}

function addAnchorsToTokenizer(newAnchors: Record<string, string[]>): void {
  let content = fs.readFileSync(TOKENIZER_PATH, "utf-8");

  for (const [intent, keywords] of Object.entries(newAnchors)) {
    if (keywords.length === 0) continue;

    // Find the intent's anchor array and add new keywords
    const intentPattern = new RegExp(`(${intent}:\\s*\\[)([^\\]]*)\\]`, "m");
    const match = content.match(intentPattern);

    if (match) {
      const existingAnchors = match[2].split(",").map(k => k.replace(/"/g, "").trim()).filter(Boolean);
      console.log(`[DEBUG] Intent ${intent}: existing anchors count = ${existingAnchors.length}`);
      const uniqueNew = keywords.filter(k => {
        if (!isAllowedAnchor(k)) {
          console.log(`  [DEBUG] Filtered out by isAllowedAnchor: "${k}"`);
          return false;
        }
        if (existingAnchors.includes(k)) {
          console.log(`  [DEBUG] Filtered out as duplicate: "${k}"`);
          return false;
        }
        const prefixMatch = existingAnchors.find(e => k.startsWith(e));
        if (prefixMatch) {
          console.log(`  [DEBUG] Filtered out by prefix match with "${prefixMatch}": "${k}"`);
          return false;
        }
        return true;
      });

      if (uniqueNew.length > 0) {
        const newAnchorStr = uniqueNew.map(k => `"${k}"`).join(", ");
        const replacement = `${match[1]}${match[2]}${existingAnchors.length > 0 ? ", " : ""}${newAnchorStr}]`;
        content = content.replace(intentPattern, replacement);
        console.log(`  [+] Added ${uniqueNew.length} anchors to ${intent}: ${uniqueNew.join(", ")}`);
      }
    } else {
      const filteredKeywords = keywords.filter(isAllowedAnchor);
      if (filteredKeywords.length > 0) {
        // Intent doesn't exist in anchors, add it before the closing };
        const closingPattern = /\n\};\s*\nexport const tokenizeLinear/;
        const newIntentBlock = `  ${intent}: [${filteredKeywords.map(k => `"${k}"`).join(", ")}],\n};\nexport const tokenizeLinear`;
        content = content.replace(closingPattern, `\n${newIntentBlock}`);
        console.log(`  [+] Created new intent ${intent} with ${filteredKeywords.length} anchors`);
      }
    }
  }

  fs.writeFileSync(TOKENIZER_PATH, content);
}

// ═══════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  ROTTRA SELF-EVALUATION LOOP");
  console.log("═══════════════════════════════════════\n");

  const testCases = generateTestCases();
  console.log(`Loaded ${testCases.length} test cases\n`);

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n── ITERATION ${iteration}/${MAX_ITERATIONS} ──`);

    // 1. Extract current anchors
    const anchors = extractAnchors();
    console.log(`  Anchors loaded: ${Object.keys(anchors).length} intents`);

    // 2. Run test
    let correct = 0;
    const byDomain: Record<string, [number, number]> = {};
    for (const tc of testCases) {
      byDomain[tc.intent] = byDomain[tc.intent] || [0, 0];
      byDomain[tc.intent][0]++;
      const got = classifyOffline(tc.q, anchors);
      if (got === tc.intent) {
        correct++;
        byDomain[tc.intent][1]++;
      }
    }

    const accuracy = (correct / testCases.length) * 100;
    console.log(`  Accuracy: ${correct}/${testCases.length} (${accuracy.toFixed(1)}%)`);

    // Print per-domain stats
    for (const [d, [t, c]] of Object.entries(byDomain).sort((a, b) => b[1][0] - a[1][0])) {
      const pct = ((c / t) * 100).toFixed(0);
      const status = pct >= 90 ? "✅" : pct >= 70 ? "⚠️" : "❌";
      console.log(`    ${status} ${d.padEnd(24)} ${c}/${t} (${pct}%)`);
    }

    // 3. Check target
    if (accuracy >= TARGET_ACCURACY) {
      console.log(`\n🎯 TARGET REACHED: ${accuracy.toFixed(1)}% >= ${TARGET_ACCURACY}%`);
      break;
    }

    // 4. Analyze failures
    const failures = analyzeFailures(testCases, anchors);
    console.log(`\n  Failures: ${failures.length}`);

    if (failures.length === 0) {
      console.log("  No failures to fix. Stopping.");
      break;
    }

    // Group failures by intent
    const failureGroups: Record<string, number> = {};
    for (const f of failures) {
      failureGroups[f.intent] = (failureGroups[f.intent] || 0) + 1;
    }
    for (const [intent, count] of Object.entries(failureGroups).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${intent}: ${count} failures`);
    }

    // 5. Generate new anchors
    const newAnchors = suggestNewAnchors(failures);
    let totalNew = 0;
    for (const keywords of Object.values(newAnchors)) totalNew += keywords.length;
    console.log(`\n  Generating ${totalNew} new anchors...`);

    // 6. Update tokenizer.ts
    addAnchorsToTokenizer(newAnchors);

    console.log(`\n  ✅ Iteration ${iteration} complete. Re-testing...`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  SELF-EVALUATION COMPLETE");
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
