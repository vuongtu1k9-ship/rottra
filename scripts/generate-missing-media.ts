#!/usr/bin/env bun
import { config } from "dotenv";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { resolve } from "path";

config();

const PUBLIC_DIR = resolve(process.cwd(), "public");
const FALLBACK_IMAGE = resolve(PUBLIC_DIR, "images/no-image.avif");

const TASKS: string[] = [
  "rice.jpg",
  "coffee.jpg",
  "tea.jpg",
  "durian.jpg",
  "mango.jpg",
  "vegetable.jpg",
  "no-image.png",
  "default-avatar.png",
];

async function main() {
  console.log(`[Offline Mode] Thêm ${TASKS.length} file ảnh còn thiếu bằng ảnh mặc định (Local Copy)...\n`);

  if (!existsSync(FALLBACK_IMAGE)) {
    console.error("Lỗi: Không tìm thấy ảnh mặc định tại " + FALLBACK_IMAGE);
    return;
  }

  for (const filename of TASKS) {
    const dest = resolve(PUBLIC_DIR, filename);
    if (existsSync(dest)) {
      console.log(`[SKIP] ${filename} đã tồn tại.`);
      continue;
    }

    console.log(`[COPY] ${filename}...`);
    try {
      copyFileSync(FALLBACK_IMAGE, dest);
      console.log(`  -> Thành công: ${dest}\n`);
    } catch (e: any) {
      console.log(`  -> Thất bại: ${e.message}\n`);
    }
  }

  console.log("Hoàn tất.");
}

main();
