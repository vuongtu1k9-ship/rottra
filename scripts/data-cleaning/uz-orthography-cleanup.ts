#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs";

/**
 * Fix two issues left by uz-orthography-fix.ts in TypeScript:
 *
 *   1. HTML attribute quotes (class="…", href="…") were curly-converted
 *      and must be restored to straight quotes.
 *   2. Inside fenced code blocks the apostrophe substitutions did not run,
 *      so Uzbek prose-in-fences keeps wrong glyphs (qo'llab → qoʻllab,
 *      to'plami → toʻplami, etc.). Apply apostrophe fixes inside fences
 *      while leaving straight " untouched (mermaid uses them as syntax).
 */

const OKINA = "ʻ";
const HAMZA = "ʼ";
const LDQUO = "“";
const RDQUO = "”";

const CODE_FENCE_RE = /^(\s*)```/;
const HTML_TAG_RE = /<[^<>\n]+>/g;

function fixApostrophes(text: string): string {
  let res = text
    .replace(/o'/g, "o" + OKINA)
    .replace(/O'/g, "O" + OKINA)
    .replace(/g'/g, "g" + OKINA)
    .replace(/G'/g, "G" + OKINA);
  return res.replace(/(?<=[A-Za-zʻ])'(?=[A-Za-z])/g, HAMZA);
}

function restoreHtmlAttrQuotes(line: string): string {
  return line.replace(HTML_TAG_RE, (match) => {
    // Replace curly double quotes back to straight quotes inside HTML tags
    return match
      .replace(new RegExp(LDQUO, "g"), '"')
      .replace(new RegExp(RDQUO, "g"), '"');
  });
}

function transform(content: string): string {
  const outLines: string[] = [];
  let inFence = false;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (CODE_FENCE_RE.test(line)) {
      inFence = !inFence;
      outLines.push(line);
      continue;
    }
    if (inFence) {
      outLines.push(fixApostrophes(line));
    } else {
      outLines.push(restoreHtmlAttrQuotes(line));
    }
  }
  return outLines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("usage: bun scripts/uz-orthography-cleanup.ts <file> [<file> ...]");
    process.exit(2);
  }
  for (const arg of args) {
    try {
      const original = readFileSync(arg, "utf-8");
      const fixed = transform(original);
      if (fixed !== original) {
        writeFileSync(arg, fixed, "utf-8");
        console.log(`cleaned: ${arg}`);
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
