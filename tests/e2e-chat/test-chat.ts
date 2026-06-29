import { generateTextLocal } from "./src/lib/agent/ai-sdk.ts";
async function run() {
  const systemPrompt = `You are Rottra Cognitive Expert, an advanced AI decision assistant.
Your task is to generate a helpful, natural, and precise response in Vietnamese answering the user's query.`;
  const query = "Nếu các Agent thương nhân được set lòng tham (greed) lên 1.0 và coi tiền là tất cả, thì đối sách nào là quan trọng nhất để chúng không tự hủy diệt nhau hoặc phá sản?";
  console.log("Asking AI...");
  const res = await generateTextLocal({ system: systemPrompt, prompt: query });
  console.log("\n--- AI REPLY ---\n");
  console.log(res.text);
}
run();
