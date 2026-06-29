import { aiTranslator } from "./src/core/nlp-cognitive/ai-translator.ts";

async function test() {
  try {
    const res = await aiTranslator.translate("Xin chào", "en", "vi");
    console.log("Result:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}

test();
