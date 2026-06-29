import { db } from "../../../src/infra/database/db-pool";
import { agentTraining } from "../../../src/infra/database/schema";
import { curriculumData } from "./curriculum-data";
import crypto from "crypto";

const generateId = () => crypto.randomBytes(8).toString("hex");

async function seedEducationCurriculum() {
  console.log("🌱 Khởi động quy trình nạp Giáo trình AI (Văn - Toán - Logic)...");

  try {
    let count = 0;
    for (const item of curriculumData) {
      await db.insert(agentTraining).values({
        id: generateId(),
        intent: item.intent,
        utterance: item.utterance,
        answer: item.answer,
      });
      count++;
      console.log(`  => Đã nạp kiến thức: [${item.intent}]`);
    }

    console.log(`\n🎉 Hoàn tất! Đã nạp thành công ${count} mẫu giáo trình vào vùng Hải mã (Hippocampus) của Agent!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi trong quá trình nạp giáo trình:", error);
    process.exit(1);
  }
}

seedEducationCurriculum();
