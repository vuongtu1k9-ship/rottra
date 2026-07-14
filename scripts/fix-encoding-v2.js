import { readFileSync, writeFileSync } from "node:fs";

const BASE = "C:/Users/L/rottra";

function replaceLines(relPath, replacements) {
  const fp = `${BASE}/${relPath}`;
  const content = readFileSync(fp, "utf-8");
  const lines = content.split("\n");
  let count = 0;
  for (const [idx, newText] of replacements) {
    if (idx >= 0 && idx < lines.length && lines[idx] !== newText) {
      lines[idx] = newText;
      count++;
    }
  }
  if (count > 0) {
    writeFileSync(fp, lines.join("\n"), "utf-8");
    console.log(`${relPath}: ${count} lines fixed`);
  } else {
    console.log(`${relPath}: no changes needed`);
  }
}

// First, let's build a helper that finds broken lines and lets us specify fixes
function findBrokenLines(relPath) {
  const fp = `${BASE}/${relPath}`;
  const content = readFileSync(fp, "utf-8");
  const lines = content.split("\n");
  const broken = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("\uFFFD")) {
      broken.push({ lineNum: i + 1, content: lines[i] });
    }
  }
  return broken;
}

// ===================== agent-response-validator.ts =====================
replaceLines("src/server/api/agent-response-validator.ts", [
  [37, '      sanitized: "D\u1EA1 em ch\u01B0a c\u00F3 th\u00F4ng tin \u0111\u1EA7y \u0111\u1EE7 \u0111\u1EC3 tr\u1EA3 l\u1EDDi c\u00E2u h\u1ECFi n\u00E0y \u0103.",'],
  [43, '    sanitized = sanitized.slice(0, MAX_RESPONSE_LENGTH) + "\\n\\n*(Ph\u1EA3n h\u1ED3i b\u1ECBt c\u00E1t ng\u1EAFn do qu\u00E1 d\u00E0i)*";'],
]);

// ===================== agent-helpers.ts =====================
// Find and report broken lines for manual fix
const helperBroken = findBrokenLines("src/server/api/agent-helpers.ts");
console.log(`\nagent-helpers.ts: ${helperBroken.length} broken lines:`);
helperBroken.forEach(({ lineNum, content }) => {
  console.log(`  L${lineNum}: ${content.trim().substring(0, 100)}`);
});

// ===================== agent-router.ts =====================
const routerBroken = findBrokenLines("src/server/api/agent-router.ts");
console.log(`\nagent-router.ts: ${routerBroken.length} broken lines:`);
routerBroken.forEach(({ lineNum, content }) => {
  console.log(`  L${lineNum}: ${content.trim().substring(0, 100)}`);
});

// ===================== guardrails.ts =====================
const guardBroken = findBrokenLines("src/core/neural-memory/guardrails.ts");
console.log(`\nguardrails.ts: ${guardBroken.length} broken lines:`);
guardBroken.forEach(({ lineNum, content }) => {
  console.log(`  L${lineNum}: ${content.trim().substring(0, 100)}`);
});

// ===================== self-correction.ts =====================
const selfBroken = findBrokenLines("src/core/nlp-cognitive/self-correction.ts");
console.log(`\nself-correction.ts: ${selfBroken.length} broken lines:`);
selfBroken.forEach(({ lineNum, content }) => {
  console.log(`  L${lineNum}: ${content.trim().substring(0, 100)}`);
});

// ===================== tokenizer.ts =====================
const tokenBroken = findBrokenLines("src/core/nlp-cognitive/tokenizer.ts");
console.log(`\ntokenizer.ts: ${tokenBroken.length} broken lines:`);
tokenBroken.forEach(({ lineNum, content }) => {
  console.log(`  L${lineNum}: ${content.trim().substring(0, 100)}`);
});
