import { agentApp } from "../../server/api/agent-router";
import fs from "node:fs";

async function runTest(query: string, role: string, usePrivateBrain: boolean) {
  const res = await agentApp.request("/chat-expert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      role,
      usePrivateBrain,
    }),
  });

  const data = await res.json();
  return {
    query,
    role,
    usePrivateBrain,
    status: res.status,
    reply: data.reply || data.text,
  };
}

const results = [];
results.push(await runTest("Phương sai mẫu là gì", "guest", false));
results.push(await runTest("Phương sai mẫu là gì", "user", false));
results.push(await runTest("Phương sai mẫu là gì", "admin", false));

fs.writeFileSync("rag_test_output_academic.json", JSON.stringify(results, null, 2));
console.log("Saved results to rag_test_output_academic.json");
process.exit(0);
