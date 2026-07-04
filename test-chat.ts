import { hybridRetrieve } from "./src/core/neural-memory/vector-rag";
import { generateTextLocal } from "./src/core/nlp-cognitive/ai-sdk";

async function testChat() {
  const query = "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 11) #" + Math.random();
  const tenantId = "default"; // Thử nghiệm với AI chính
  
  console.log(`[KHÁCH HÀNG]: ${query}`);
  console.log(`[SYSTEM]: Đang tìm kiếm trong Neural Memory của Agent ${tenantId}...`);
  
  const memories = await hybridRetrieve(query, 3, tenantId);
  
  console.log("\n[AGENT RECALL]:");
  let ragContext = "";
  if (memories && memories.length > 0) {
    memories.forEach((mem: any, i: number) => {
      const title = mem.doc?.title || mem.doc?.item?.title || "Không rõ";
      const content = mem.doc?.content || mem.doc?.item?.content || mem.doc?.flatText || "";
      console.log(`${i+1}. Score: ${mem.hybridScore.toFixed(3)} - ${title}`);
      ragContext += `${content}\n`;
    });
  } else {
    console.log("Không tìm thấy ký ức nào liên quan, sẽ dùng kiến thức nền tảng.");
  }
    
  console.log("\n[SYSTEM]: Đang suy nghĩ phản hồi bằng Hybrid AI (Gemini/Local)...");
  
  const systemPrompt = `Bạn là Trợ lý Rottra (AI chính của hệ thống). Bạn am hiểu tâm lý học hành vi, triết học phương đông và kinh doanh. Hãy xưng hô là 'Em' và gọi khách là 'Sếp' hoặc 'Anh'. 
  
KÝ ỨC BẠN NHỚ LẠI (Nếu có):
${ragContext}
  
YÊU CẦU: Khách hàng đang hỏi về chủ đề "5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói". Hãy dùng phong cách giao tiếp điềm tĩnh, sâu sắc của bạn để phân tích và liên hệ với triết lý kinh doanh hoặc cuộc sống, tạo sự nể trọng từ khách. Không nói dài dòng.`;
  
  const llmResult = await generateTextLocal({
    system: systemPrompt,
    prompt: query,
    userId: "guest"
  });
  
  console.log(`\n[TRỢ LÝ ROTTRA (AI CHÍNH)]:\n${llmResult?.text}`);
  
  process.exit(0);
}

testChat();
