import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
console.log("Key length:", GROQ_API_KEY.length);

async function run() {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Say hello!" }],
    }),
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", data);
}
run();
