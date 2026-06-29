/**
 * 🎓 ROTTRA NLP SEED — Nạp dữ liệu huấn luyện cho 7 lĩnh vực
 * Run: bun src/db/seed-training.ts
 */
import { db } from "./db";
import { agentTraining, user } from "./schema";
import { sql } from "drizzle-orm";
import { ALL_DOMAIN_TRAINING_PAIRS, DOMAIN_LABELS } from "../../../src/core/nlp-cognitive/domain-training-data";

const SYSTEM_INTENTS = ["GREETING", "DEBUG", "REPORT", "NAVIGATION", "CLEAR", "AUTHOR", "PHILOSOPHY", "ANALYZE_MARKET", "STATUS", "DEEPMIND", "CONTINUE", "DATABASE_ENRICH", "COMPLAINT", "STATISTICS", "FORECAST", "MANAGEMENT", "REASONING", "ACADEMIC", "WEB_SEARCH", "MEM0", "OPENHUMAN", "RUFLO", "MEGAMIND", "OPENDESIGN", "CONFIRMATION", "RESEARCH"];

async function main() {
  console.log("🧠 Bắt đầu huấn luyện NLP — Rotta 7 Domain System");
  console.log("═══════════════════════════════════════════");

  // 1. Tạo toàn bộ AgentTraining rows cho từng domain
  let totalInserted = 0;
  const domainCounts: Record<string, number> = {};

  for (const pair of ALL_DOMAIN_TRAINING_PAIRS) {
    const domainLabel = DOMAIN_LABELS[pair.intent] || pair.intent;
    const id = `seed_${pair.intent}_${crypto.randomUUID().split("-")[0].toUpperCase()}`;

    try {
      await db.insert(agentTraining).values({
        id,
        intent: pair.intent,
        utterance: pair.utterance,
        answer: pair.answer,
        addAt: new Date().toISOString(),
      });
      domainCounts[domainLabel] = (domainCounts[domainLabel] || 0) + 1;
      totalInserted++;
    } catch (e: any) {
      console.error(`   ❌ Lỗi insert [${pair.intent}]: ${e.message}`);
    }
  }

  // 2. Insert core NLP utterance pairs vào AgentTraining (15 domain cốt lõi)
  const systemUtterances: { intent: string; utterance: string; answer: string }[] = [
    // GREETING
    { intent: "GREETING", utterance: "chào bạn", answer: "Xin chào Sếp! Tôi là đội ngũ AI Rotta, sẵn sàng hỗ trợ mọi lĩnh vực nông nghiệp, toán học, logistics và nghiên cứu khoa học." },
    { intent: "GREETING", utterance: "hello", answer: "Hello! I am Rotta AI, your multi-domain agricultural and scientific assistant. How can I help you today?" },
    // CONFIRMATION
    { intent: "CONFIRMATION", utterance: "chắc không", answer: "Chắc chắn rồi Sếp! Tất cả các tính toán và phân tích đều được kiểm tra bởi mô hình toán học chuẩn." },
    // DEBUG
    { intent: "DEBUG", utterance: "lỗi hệ thống", answer: "Để kiểm tra lỗi, tôi cần biết chi tiết: lỗi xuất hiện khi nào, thông báo lỗi là gì, và bước bạn vừa thực hiện trước khi xảy ra lỗi." },
    // RESEARCH confirm
    { intent: "RESEARCH", utterance: "làm sao viết bài báo khoa học chuẩn IMRAD", answer: "**4 bước viết IMRAD:**\n1. **Intro** — Đặt vấn đề, mục tiêu nghiên cứu\n2. **Methods** — Thiết kế thí nghiệm, thu thập dữ liệu\n3. **Results** — Phân tích số liệu, bảng biểu, p-value\n4. **Discussion** — Giải thích, so sánh, kết luận\n\nCần thêm Abstract (150-250 từ) và References chuẩn APA 7th" },
  ];

  for (const row of systemUtterances) {
    const id = `sys_${row.intent}_${crypto.randomUUID().split("-")[0].toUpperCase()}`;
    try {
      await db
        .insert(agentTraining)
        .values({
          id,
          intent: row.intent,
          utterance: row.utterance,
          answer: row.answer,
          addAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
      totalInserted++;
    } catch (e) {
      /* duplicate skip */
    }
  }

  // 3. Tạo user hệ thống nếu chưa có
  const systemUserId = "system_agent_user";
  try {
    await db
      .insert(user)
      .values({
        id: systemUserId,
        name: "Trợ Lý Cao Cấp Rotta NLP",
        email: "nlp-agent@rottra.local",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "agent",
      })
      .onConflictDoNothing();
    console.log("✅ User hệ thống đã sẵn sàng.");
  } catch (e) {
    console.log("ℹ️  User đã tồn tại, bỏ qua.");
  }

  // 4. Log thống kê
  console.log("\n═══════════════════════════════════════════");
  console.log(`📊 Tổng cộng đã nạp: ${totalInserted} cặp huấn luyện`);
  console.log("\n📁 Phân bổ theo lĩnh vực:");
  console.log("───────────────────────────────────────────");
  // Combine counts
  const allCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(domainCounts)) {
    allCounts[k] = v;
  }
  for (const k of Object.keys(DOMAIN_LABELS)) {
    if (!allCounts[DOMAIN_LABELS[k]]) allCounts[DOMAIN_LABELS[k]] = 0;
  }
  for (const [label, count] of Object.entries(allCounts).sort((a, b) => b[1] - a[1])) {
    const bar = "█".repeat(Math.min(count, 50));
    console.log(`   ${label.padEnd(40)} ${count.toString().padStart(4)} ${bar}`);
  }
  console.log("═══════════════════════════════════════════");
  console.log("\n⚡ Để kích hoạt NLP engine mới, restart server:");
  console.log("   bun src/index.tsrx");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
