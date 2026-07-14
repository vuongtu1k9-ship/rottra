import { createLogger } from "~/shared/logger";
import { parseArgs } from "node:util";

const log = createLogger("entry-server");

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
      help: {
        type: "boolean",
        short: "h",
      },
      env: {
        type: "string",
        short: "e",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  // Bỏ qua 2 tham số đầu tiên của Bun.argv (đường dẫn bun và file script)
  const commands = positionals.slice(2);

  if (values.help || commands.length === 0) {
    log.info(`
🚀 Rottra CLI Tool
-----------------------------------
Cách dùng: bun run src/cli.ts [command] [options]

Commands:
  seed        Chạy dữ liệu mẫu vào DB
  migrate     Chạy Drizzle migration
  test        Chạy script test cục bộ

Options:
  --help, -h  Hiển thị hướng dẫn này
  --env, -e   Chỉ định môi trường (dev/prod)
`);
    return;
  }

  const command = commands[0];
  log.info(`[CLI] Đang thực thi lệnh: ${command}`);

  switch (command) {
    case "seed":
      log.info("🌱 Đang chạy Seeder...");
      // import và gọi hàm seed ở đây
      break;
    case "migrate":
      log.info("📦 Đang chạy Migration...");
      // gọi hàm migrate
      break;
    case "test":
      break;
    default:
      log.error(`❌ Lệnh không hợp lệ: "${command}"`);
      log.info("Dùng cờ --help để xem danh sách lệnh.");
      process.exit(1);
  }
}

main().catch((err) => {
  log.error("❌ Lỗi nghiêm trọng CLI:", err);
  process.exit(1);
});
