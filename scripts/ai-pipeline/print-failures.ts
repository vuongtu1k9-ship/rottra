import * as fs from "fs";
import * as path from "path";
import { removeAccents } from "../../src/core/nlp-cognitive/tokenizer";

const TOKENIZER_PATH = path.join(__dirname, "../../src/core/nlp-cognitive/tokenizer.ts");

const SPECIFICITY: Record<string, number> = {
  MARKET_PRICE: 1.5, FARMING_TECHNIQUE: 1.5, WEATHER_SEASON: 1.4,
  FINANCE_COST: 1.4, CUSTOMER_SERVICE: 1.3, SMART_AGRI: 1.3,
  PRODUCT_DETAIL: 1.2, NEGOTIATION_PROMO: 1.2, ORDER_PAYMENT: 1.2,
  CONVERSATIONAL: 0.8, SEARCH: 1.0, GREETING: 1.0, COMPLAINT: 1.0,
  NAVIGATION: 1.0,
};

function extractAnchors(): Record<string, string[]> {
  const fileContent = fs.readFileSync(TOKENIZER_PATH, "utf-8");
  const match = fileContent.match(/export const SEMANTIC_ANCHORS: Record<string, string\[\]> = (\{[\s\S]*?\});/);
  if (!match) return {};
  return eval(`(${match[1]})`);
}

function classifyOffline(q: string, anchors: Record<string, string[]>): string {
  const c = removeAccents(q).toLowerCase().trim();

  // Pass 1: exact match
  for (const [intent, kws] of Object.entries(anchors)) {
    for (const kw of kws) {
      if (!kw) continue;
      const kc = removeAccents(kw).toLowerCase().trim();
      const ok = kc.length <= 3
        ? new RegExp(`\\b${kc}\\b`, "i").test(c)
        : c.includes(kc);
      if (ok) {
        const s = (kc.length / c.length) * (SPECIFICITY[intent] || 1);
        if (s >= 0.5) return intent;
      }
    }
  }

  // Pass 2: fuzzy match
  let best = "SEARCH", bestS = 0;
  for (const [intent, kws] of Object.entries(anchors)) {
    for (const kw of kws) {
      if (!kw) continue;
      const kc = removeAccents(kw).toLowerCase().trim();
      const ok = kc.length <= 3
        ? new RegExp(`\\b${kc}\\b`, "i").test(c)
        : c.includes(kc);
      if (ok) {
        const s = (kc.length / c.length) * (SPECIFICITY[intent] || 1);
        if (s > bestS && s < 0.5) { bestS = s; best = intent; }
      }
    }
  }
  return best;
}

import { generateTestCases } from "./self-eval-loop";

const testCases = generateTestCases();
const anchors = extractAnchors();

console.log("=== EVALUATION FAILURES ===");
let count = 0;
for (const tc of testCases) {
  const got = classifyOffline(tc.q, anchors);
  if (got !== tc.intent) {
    count++;
    console.log(`${count}. Query: "${tc.q}"`);
    console.log(`   Expected: ${tc.intent}`);
    console.log(`   Got:      ${got}`);
  }
}
