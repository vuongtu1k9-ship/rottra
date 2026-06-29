import { generateTextLocal } from "./src/lib/agent/ai-sdk.ts";
async function run() {
  const llmResult = await generateTextLocal({ system: "You are helpful assistant", prompt: "Hello!" });
  console.log("FINAL RESULT:", llmResult.text);
}
run();
