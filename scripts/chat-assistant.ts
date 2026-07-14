/**
 * Rottra Assistant CLI
 * Trò chuyện với Api trợ lý qua /api/agent/chat-expert từ terminal.
 *
 * Usage:
 *   bun scripts/chat-assistant.ts
 *   ROTTRA_API_URL=http://localhost:5173 bun scripts/chat-assistant.ts
 *
 * Lệnh trong phiên:
 *   /exit, /quit        - Thoát
 *   /lang <vi|en|...>   - Đổi ngôn ngữ phản hồi
 *   /brain <on|off>     - Bật/tắt private brain
 *   /clear              - Xoá lịch sử phiên (chỉ local)
 */

const API_URL = (process.env.ROTTRA_API_URL || "http://localhost:5173").replace(/\/$/, "");
const ENDPOINT = `${API_URL}/api/agent/chat-expert`;

let lang = "vi";
let usePrivateBrain = true;
const history: { role: string; content: string }[] = [];

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";

import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });

function question(promptText: string): Promise<string> {
  return new Promise((resolve) => rl.question(promptText, resolve));
}

function log(line: string, color = "") {
  process.stdout.write(`${color}${line}${RESET}\n`);
}

async function ask(query: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, lang, usePrivateBrain }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      log(`⏱  Hết thời gian chờ (180s). Kiểm tra server tại ${API_URL}.`, RED);
    } else {
      log(`✗  Không gửi được yêu cầu: ${err.message}`, RED);
      log(`  Đảm bảo dev server đang chạy: bun run dev  (${API_URL})`, DIM);
    }
    return;
  }
  clearTimeout(timeout);

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    log(`✗  Phản hồi không phải JSON (HTTP ${res.status}): ${text.slice(0, 200)}`, RED);
    return;
  }

  if (!res.ok || data.success === false) {
    log(`✗  Lỗi API (HTTP ${res.status}): ${data.reply || text.slice(0, 200)}`, RED);
    return;
  }

  log(`${BOLD}${GREEN}Trợ lý:${RESET} ${data.reply ?? "(không có phản hồi)"}`);

  if (Array.isArray(data.suggestions) && data.suggestions.length) {
    log(`${DIM}  Gợi ý: ${data.suggestions.join(" · ")}${RESET}`, DIM);
  }
  if (Array.isArray(data.results) && data.results.length) {
    const names = data.results
      .map((p: any) => p.name || p.title || p.productName)
      .filter(Boolean)
      .slice(0, 5);
    if (names.length) log(`${DIM}  Sản phẩm: ${names.join(" · ")}${RESET}`, DIM);
  }
  if (data.intent || typeof data.confidence === "number") {
    log(`${DIM}  [intent=${data.intent ?? "?"} · confidence=${data.confidence ?? "?"} · source=${data.source ?? "?"}]${RESET}`, DIM);
  }

  history.push({ role: "user", content: query });
  history.push({ role: "assistant", content: data.reply ?? "" });
}

async function main() {
  log(`${BOLD}Rottra Assistant CLI${RESET}  →  ${ENDPOINT}`, CYAN);
  log(`Ngôn ngữ: ${lang} · Private brain: ${usePrivateBrain ? "bật" : "tắt"}`, DIM);
  log(`Gõ ${YELLOW}/help${RESET} để xem lệnh. Ctrl+C để thoát.`, DIM);

  while (true) {
    let line: string;
    try {
      line = (await question(`${BOLD}${CYAN}Bạn:${RESET} `)).trim();
    } catch {
      break;
    }
    if (!line) continue;

    if (line.startsWith("/")) {
      const [cmd, ...rest] = line.slice(1).split(/\s+/);
      switch (cmd) {
        case "exit":
        case "quit":
          log("Tạm biệt!", GREEN);
          rl.close();
          return;
        case "help":
          log(`${YELLOW}/exit${RESET}, ${YELLOW}/quit${RESET}  thoát`, DIM);
          log(`${YELLOW}/lang${RESET} <vi|en|...>  đổi ngôn ngữ`, DIM);
          log(`${YELLOW}/brain${RESET} <on|off>  bật/tắt private brain`, DIM);
          log(`${YELLOW}/clear${RESET}  xoá lịch sử phiên`, DIM);
          break;
        case "lang":
          if (rest[0]) {
            lang = rest[0];
            log(`Đã đổi ngôn ngữ → ${lang}`, GREEN);
          }
          break;
        case "brain":
          if (rest[0] === "on") usePrivateBrain = true;
          else if (rest[0] === "off") usePrivateBrain = false;
          log(`Private brain: ${usePrivateBrain ? "bật" : "tắt"}`, GREEN);
          break;
        case "clear":
          history.length = 0;
          log("Đã xoá lịch sử phiên.", GREEN);
          break;
        default:
          log(`Lệnh không rõ: ${cmd} (gõ /help)`, YELLOW);
      }
      continue;
    }

    await ask(line);
  }
}

main().catch((err) => {
  log(`Lỗi: ${err?.message ?? err}`, RED);
  process.exit(1);
});
