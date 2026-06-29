import { spawnSync } from "node:child_process";
import path from "node:path";

console.log("🌱 [Master Seed] Bắt đầu chạy toàn bộ Seeder CSDL...");

const dbDir = path.dirname(new URL(import.meta.url).pathname);

const seeders = [
  "seed_presets.ts",
  "seed-training.ts",
  "seed-common-vietnamese.ts",
  "seed-lexicon.ts",
  "seed-lexicon-advanced.ts",
  "seed-moods.ts",
  "seed_education.ts",
  "seed_psychology.ts",
  "seed_semantic_pointer.ts",
  "seed-economy.ts"
];

for (const seeder of seeders) {
  const seederPath = path.join(dbDir, seeder);
  console.log(`\n🚀 [Master Seed] Đang chạy: ${seeder}...`);
  const result = spawnSync("bun", ["run", seederPath], { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(`❌ Lỗi khi thực thi ${seeder}. Quá trình gieo hạt bị ngắt.`);
    process.exit(1);
  }
}

console.log("\n🎉 [Master Seed] Tất cả CSDL đã được nạp dữ liệu thành công!");
process.exit(0);
