#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs";

/**
 * Apply Uzbek Latin orthography fixes to translated markdown files in TypeScript.
 *
 * Rules:
 *   - o' -> oʻ, O' -> Oʻ, g' -> gʻ, G' -> Gʻ  (modifier letter turned comma U+02BB)
 *   - All other word-internal `'` -> ʼ            (modifier letter apostrophe U+02BC)
 *   - "..." -> “...”                              (curly double quotes, paired)
 *   - shablon -> andoza (case-preserving)
 *
 * Code fences (```), inline code (`...`), and URLs are skipped.
 */

const OKINA = "ʻ";      // ʻ — for oʻ / gʻ
const HAMZA = "ʼ";      // ʼ — for maʼruza / sunʼiy / eʼlon
const LDQUO = "“";      // “
const RDQUO = "”";      // ”

function fixApostrophes(text: string): string {
  let res = text
    .replace(/o'/g, "o" + OKINA)
    .replace(/O'/g, "O" + OKINA)
    .replace(/g'/g, "g" + OKINA)
    .replace(/G'/g, "G" + OKINA);
  // Lookbehind (?<=[A-Za-zʻ]) and lookahead (?=[A-Za-z]) in TS Regex
  return res.replace(/(?<=[A-Za-zʻ])'(?=[A-Za-z])/g, HAMZA);
}

function fixDoubleQuotes(text: string): string {
  const out: string[] = [];
  let openQ = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      out.push(openQ ? LDQUO : RDQUO);
      openQ = !openQ;
    } else {
      out.push(ch);
      if (ch === "\n") {
        openQ = true;
      }
    }
  }
  return out.join("");
}

function fixShablon(text: string): string {
  return text
    .replace(/\bShablon\b/g, "Andoza")
    .replace(/\bshablon\b/g, "andoza");
}

function fixCommonTypos(text: string): string {
  // qaer* → qayer*
  text = text.replace(/\bqaer(da|ga|dan)?\b/gi, (match, suffix) => {
    const isCap = match.startsWith("Q");
    return (isCap ? "Qayer" : "qayer") + (suffix || "");
  });
  // senariy → ssenariy
  text = text.replace(/\bsenariy/g, "ssenariy").replace(/\bSenariy/g, "Ssenariy");

  // English loanwords ending in 'g' + suffix: ʻ → ʼ
  const stems = ["bug", "tag", "log", "flag", "slug", "debug", "blog", "ping", "config"];
  for (const stem of stems) {
    const capStem = stem.charAt(0).toUpperCase() + stem.slice(1);
    text = text.replace(new RegExp(stem + "ʻ", "g"), stem + "ʼ");
    text = text.replace(new RegExp(capStem + "ʻ", "g"), capStem + "ʼ");
  }
  return text;
}

const INLINE_CODE_RE = /`[^`\n]+`/g;
const URL_RE = /https?:\/\/\S+/g;
const LINK_PATH_RE = /\]\([^)]+\)/g;

function protect(text: string): { protectedText: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const stash = (match: string) => {
    placeholders.push(match);
    return `\x00PH${placeholders.length - 1}\x00`;
  };
  let protectedText = text.replace(INLINE_CODE_RE, stash);
  protectedText = protectedText.replace(URL_RE, stash);
  protectedText = protectedText.replace(LINK_PATH_RE, stash);
  return { protectedText, placeholders };
}

function restore(text: string, placeholders: string[]): string {
  for (let i = placeholders.length - 1; i >= 0; i--) {
    text = text.replace(`\x00PH${i}\x00`, placeholders[i]);
  }
  return text;
}

const CODE_FENCE_RE = /^(\s*)```/;

function transform(content: string): string {
  const outLines: string[] = [];
  let inFence = false;
  // Handle both CRLF and LF
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (CODE_FENCE_RE.test(line)) {
      inFence = !inFence;
      outLines.push(line);
      continue;
    }
    if (inFence) {
      outLines.push(line);
      continue;
    }
    const { protectedText, placeholders } = protect(line);
    let processed = fixApostrophes(protectedText);
    processed = fixDoubleQuotes(processed);
    processed = fixShablon(processed);
    processed = fixCommonTypos(processed);
    outLines.push(restore(processed, placeholders));
  }
  return outLines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("usage: bun scripts/uz-orthography-fix.ts <file> [<file> ...]");
    process.exit(2);
  }
  for (const arg of args) {
    try {
      const original = readFileSync(arg, "utf-8");
      const fixed = transform(original);
      if (fixed !== original) {
        writeFileSync(arg, fixed, "utf-8");
        console.log(`fixed: ${arg}`);
      } else {
        console.log(`unchanged: ${arg}`);
      }
    } catch (e: any) {
      console.error(`Error processing ${arg}:`, e.message);
    }
  }
}

if (import.meta.main || require.main === module) {
  main();
}
