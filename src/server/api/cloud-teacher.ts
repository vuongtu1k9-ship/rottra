import { db } from "~/infra/database/db-pool";
import { agentTraining } from "~/infra/database/schema";
import crypto from "crypto";

export async function teachRottraViaCloudLLM(query: string) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[Cloud Teacher] Không tìm thấy GROQ_API_KEY. Bỏ qua tự học.");
      return;
    }

    const systemPrompt = `Bạn là một chuyên gia đào tạo tri thức cho Hệ sinh thái Nông sản Rottra.
Hãy giải đáp câu hỏi của người dùng một cách ngắn gọn, súc tích và chuyên nghiệp nhất.
Câu trả lời của bạn sẽ được Rottra học thuộc lòng và sử dụng làm vốn từ của chính nó.
KHÔNG xưng hô "tôi là AI", KHÔNG trả lời vòng vo. Trực tiếp đi vào trọng tâm vấn đề.
Độ dài tối đa 150 từ. Trả lời bằng tiếng Việt.`;

    const body = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Câu hỏi cần học: "${query}"` },
      ],
      temperature: 0.3,
    };

    console.log(`[Cloud Teacher] Đang gọi Groq (Llama 3) API để dạy Rottra câu hỏi: "${query}"...`);

    const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("[Cloud Teacher] Lỗi từ Groq API:", response.statusText);
      return;
    }

    const data = await response.json();
    const answerText = data.choices?.[0]?.message?.content;

    if (answerText) {
      // Lưu vào CSDL AgentTraining để Rottra "học thuộc" vĩnh viễn
      await db.insert(agentTraining).values({
        id: crypto.randomUUID(),
        intent: "LEARNED_CLOUD_" + Date.now(),
        utterance: query.trim(),
        answer: "🧠 [Rottra Tự Học]: " + answerText.trim(),
      });
      console.log(`[Cloud Teacher] Thành công! Rottra đã nạp tri thức mới vào bộ nhớ lõi cho câu: "${query}"`);
    }
  } catch (error: any) {
    console.error("[Cloud Teacher] Lỗi quá trình học:", error.message);
  }
}
