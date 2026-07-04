import { handleChatExpert } from "./src/server/api/agent-chat";
import { Hono } from "hono";
const app = new Hono();
app.post("/test", handleChatExpert);

async function run() {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 11) #" + Math.random(),
      usePrivateBrain: true,
      lang: "vi"
    })
  });
  const res = await app.fetch(req);
  const text = await res.text();
  console.log(text);
}
run();
