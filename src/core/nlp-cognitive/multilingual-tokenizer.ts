let tokenizerReady = true;

const TOKENIZER_MODEL = "Rottra-Native-Fallback-Tokenizer";

export async function initMultilingualTokenizer(): Promise<void> {
  // Now strictly using fallback native TS tokenizer. No external dependencies.
  tokenizerReady = true;
  console.log("[NLP-MT] Native Fallback Tokenizer loaded successfully");
}

export function isMultilingualReady(): boolean {
  return tokenizerReady;
}

export function multilingualEncode(text: string): number[] {
  // Fallback encoding: just char codes
  return fallbackTokenize(text).map((t) => t.charCodeAt(0) || 0);
}

export function multilingualDecode(tokenIds: number[]): string {
  // Fallback decoding
  return tokenIds.map((id) => String.fromCharCode(id)).join("");
}

export function multilingualTokenize(text: string): string[] {
  return fallbackTokenize(text);
}

function fallbackTokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  let current = "";
  for (const char of text) {
    if (/[\s\u00A0\u200B]/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else if (isCJK(char) || isHebrew(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function isCJK(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff) ||
    (code >= 0xf900 && code <= 0xfaff)
  );
}

function isHebrew(char: string): boolean {
  const code = char.codePointAt(0)!;
  return code >= 0x0590 && code <= 0x05ff;
}

export function getTokenizerInfo(): { model: string; ready: boolean; vocabSize: number } {
  return {
    model: TOKENIZER_MODEL,
    ready: tokenizerReady,
    vocabSize: 32000,
  };
}
