import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

console.log("🔄 [AI Auto-Sync] Đang tự động cập nhật tri thức cho AI...");

const repoRoot = process.cwd();

// 1. Chạy CodeGraph Sync
console.log("📡 Đang đồng bộ hóa sơ đồ code (CodeGraph)...");
const codegraphBin = path.join(repoRoot, "node_modules", "@colbymchenry", "codegraph-linux-x64", "bin", "codegraph");
const syncResult = spawnSync(codegraphBin, ["sync", "--quiet"], { stdio: "inherit" });

if (syncResult.status !== 0) {
  console.log("⚠️ Không thể chạy CodeGraph sync hoặc chưa cài đặt đầy đủ. Bỏ qua bước này.");
} else {
  console.log("✅ CodeGraph đã đồng bộ hóa thành công.");
}

// 2. Lấy danh sách tệp thay đổi từ Git
console.log("🔍 Đang truy vấn các tệp thay đổi từ Git...");
const gitDiff = spawnSync("git", ["diff", "--name-only"], { encoding: "utf-8" });
const gitDiffCached = spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf-8" });
// Lấy các tệp thay đổi ở commit gần nhất nếu vừa commit xong
const gitLastCommit = spawnSync("git", ["diff", "HEAD~1", "HEAD", "--name-only"], { encoding: "utf-8" });

const changedFiles = new Set<string>();

const addFiles = (output: string) => {
  if (!output) return;
  output.split("\n").forEach((file) => {
    const trimmed = file.trim();
    if (
      trimmed &&
      trimmed !== "progress.md" &&
      trimmed !== "session-handoff.md" &&
      !trimmed.startsWith(".git") &&
      !trimmed.startsWith("node_modules")
    ) {
      changedFiles.add(trimmed);
    }
  });
};

addFiles(gitDiff.stdout);
addFiles(gitDiffCached.stdout);
addFiles(gitLastCommit.stdout);

const filesList = Array.from(changedFiles);

// 3. Tự động cập nhật file progress.md
const progressPath = path.join(repoRoot, "progress.md");
if (existsSync(progressPath) && filesList.length > 0) {
  console.log("📝 Đang tự động cập nhật danh sách tệp thay đổi vào progress.md...");
  let progressContent = readFileSync(progressPath, "utf-8");

  // Cập nhật Last Updated
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  progressContent = progressContent.replace(
    /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
    `**Last Updated:** ${dateStr}`
  );

  // Đọc các tệp hiện tại trong phần ## Files Modified This Session để không làm mất mô tả cũ
  const filesSectionHeader = "## Files Modified This Session";
  const lines = progressContent.split("\n");
  const fileDescriptions = new Map<string, string>();
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(filesSectionHeader)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      inSection = false;
    }
    if (inSection) {
      // Tìm dòng dạng: - `filepath` - mô tả
      const match = line.match(/^\s*-\s*`([^`]+)`(?:\s*-\s*(.+))?$/);
      if (match) {
        fileDescriptions.set(match[1], match[2] || "");
      }
    }
  }

  // Thêm các tệp mới từ Git chưa có trong danh sách
  for (const file of filesList) {
    if (!fileDescriptions.has(file)) {
      fileDescriptions.set(file, "Tự động cập nhật.");
    }
  }

  // Tạo lại đoạn text cho section
  let newSectionContent = `${filesSectionHeader}\n\n`;
  fileDescriptions.forEach((desc, file) => {
    if (desc) {
      newSectionContent += `- \`${file}\` - ${desc}\n`;
    } else {
      newSectionContent += `- \`${file}\`\n`;
    }
  });
  newSectionContent += "\n";

  // Thay thế section cũ trong file
  const sectionStartIdx = progressContent.indexOf(filesSectionHeader);
  if (sectionStartIdx !== -1) {
    let sectionEndIdx = progressContent.indexOf("## ", sectionStartIdx + filesSectionHeader.length);
    if (sectionEndIdx === -1) {
      sectionEndIdx = progressContent.length;
    }
    progressContent =
      progressContent.substring(0, sectionStartIdx) +
      newSectionContent +
      progressContent.substring(sectionEndIdx);
  }

  writeFileSync(progressPath, progressContent, "utf-8");
  console.log("✅ Đã cập nhật progress.md.");
}

// 4. Chạy kiểm tra code tự động (Harness Verification)
console.log("🧪 Đang chạy kiểm thử tự động...");
const isWin = process.platform === "win32";
let initStatus = 0;

if (isWin) {
  const resInstall = spawnSync("bun", ["install"], { stdio: "inherit", shell: true });
  const resFormat = spawnSync("bun", ["run", "format"], { stdio: "inherit", shell: true });
  const resTsc = spawnSync("bun", ["x", "tsc", "--noEmit"], { stdio: "inherit", shell: true });
  const resBuild = spawnSync("bun", ["run", "build"], { stdio: "inherit", shell: true });
  
  if (resInstall.status !== 0 || resBuild.status !== 0) {
    initStatus = 1;
  }
} else {
  const initResult = spawnSync("./init.sh", { stdio: "inherit" });
  initStatus = initResult.status ?? 0;
}

console.log("📏 Đang kiểm tra điểm chất lượng Harness...");
const harnessResult = spawnSync("bun", ["scripts/build-tools/validate-harness.ts", "--target", "."], { stdio: "inherit" });

if (initStatus === 0 && harnessResult.status === 0) {
  console.log("🎉 [AI Auto-Sync Hoàn Tất] Mọi thứ đã sẵn sàng, được đồng bộ và đạt điểm chất lượng tối đa!");
} else {
  console.log("⚠️ Phát hiện lỗi khi chạy thử code hoặc Harness chưa đạt chuẩn. Vui lòng kiểm tra lại.");
}
