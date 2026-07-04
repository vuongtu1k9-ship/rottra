import { fetch } from "bun";

console.log("=================================================");
console.log("🤖 ROTTRA AUTO-CHATTER: 1-HOUR STRESS TEST");
console.log("=================================================");
console.log("Mục tiêu: Giao tiếp liên tục với Rottra AI trong 1 giờ.");
console.log("Mục đích: Kiểm tra rò rỉ bộ nhớ (Memory Leak), Context Window, và Rate Limit.");
console.log("=================================================\n");

const API_URL = "http://localhost:36691/api/agent/chat-expert"; 
const SESSION_ID = `stress-test-${Date.now()}`;
const DURATION_MS = 60 * 60 * 1000; // 1 giờ
const DELAY_BETWEEN_CHATS = 30 * 1000; // 30 giây mỗi câu hỏi

const conversationTopics = [
  "Bạn là ai và bạn làm được gì?",
  "Hãy tóm tắt lại những gì chúng ta vừa nói.",
  "Giải thích cho tôi về lý thuyết trò chơi (Game Theory).",
  "Nếu tôi là một nhà toán học, bạn sẽ hỗ trợ tôi như thế nào?",
  "Bạn có nhớ tên của phiên làm việc này không?",
  "Dữ liệu của tôi có được bảo mật không?",
  "Hãy phân tích sự khác nhau giữa Array và Float32Array.",
  "Mạng nơ-ron nhân tạo hoạt động như thế nào?",
  "Bạn có khả năng tự động học hỏi từ tôi không?",
  "Hãy cho tôi một ví dụ về mã code SolidJS.",
  "Điểm khác biệt lớn nhất của Rottra so với ChatGPT là gì?",
  "Tôi muốn tự động hóa công việc văn phòng, bạn có thể giúp gì?"
];

let chatCount = 0;
const startTime = Date.now();

async function sendChatMessage() {
  const now = Date.now();
  if (now - startTime > DURATION_MS) {
    console.log("\n✅ Đã hoàn thành 1 GIỜ giao tiếp liên tục với AI! Kết thúc Stress Test.");
    process.exit(0);
  }

  const topicIndex = chatCount % conversationTopics.length;
  let message = conversationTopics[topicIndex];
  
  // Đảo ngữ cảnh một chút để tránh AI bị nhàm chán
  if (chatCount > conversationTopics.length) {
      message = `Câu hỏi thứ ${chatCount + 1}: ${message}`;
  }

  console.log(`\n[${new Date().toLocaleTimeString()}] 👤 User: ${message}`);
  
  const reqStart = performance.now();
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        sessionId: SESSION_ID,
        agentId: "suGia", // Gọi trực tiếp nhân cách Sử Gia
        userId: "bot-tester",
        tenantId: "global"
      })
    });

    const resTime = ((performance.now() - reqStart) / 1000).toFixed(2);

    if (!response.ok) {
      console.error(`❌ [${resTime}s] Lỗi API: ${response.status} - ${response.statusText}`);
      // Lỗi 429 là Rate Limit của Gemini
      if (response.status === 429) {
          console.log("⚠️ Chạm ngưỡng Rate Limit của AI Model (Gemini/Claude). Bot sẽ ngủ đông 60 giây...");
          setTimeout(sendChatMessage, 60000); // Ngủ 1 phút nếu bị Rate Limit
          return;
      }
    } else {
      const data = await response.json();
      console.log(`🤖 [${resTime}s] Rottra AI: ${data.message.substring(0, 150)}...`);
    }

  } catch (error: any) {
    console.error(`💥 Lỗi kết nối đến Server: ${error.message}`);
  }

  chatCount++;
  
  const elapsedMinutes = ((now - startTime) / 60000).toFixed(1);
  console.log(`⏳ Đã chạy: ${elapsedMinutes}/60 phút. Chờ ${DELAY_BETWEEN_CHATS/1000}s để gửi câu tiếp theo...`);

  setTimeout(sendChatMessage, DELAY_BETWEEN_CHATS);
}

// Bắt đầu vòng lặp
console.log(`Bắt đầu mô phỏng phiên chat ID: ${SESSION_ID}`);
sendChatMessage();
