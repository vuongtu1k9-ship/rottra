import { AutoTokenizer, env } from "@xenova/transformers";

env.allowLocalModels = false;

let cachedTokenizer: any = null;
let tokenizerReady = false;

const TOKENIZER_MODEL = "Xenova/xlm-roberta-base";

export async function initMultilingualTokenizer(): Promise<void> {
  if (tokenizerReady) return;
  try {
    cachedTokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL);
    tokenizerReady = true;
    console.log("[NLP-MT] XLM-RoBERTa tokenizer loaded successfully");
  } catch (err: any) {
    console.error("[NLP-MT] Failed to load tokenizer:", err.message);
  }
}

export function isMultilingualReady(): boolean {
  return tokenizerReady;
}

export function multilingualEncode(text: string): number[] {
  if (!cachedTokenizer || !text) return [];
  return cachedTokenizer.encode(text);
}

export function multilingualDecode(tokenIds: number[]): string {
  if (!cachedTokenizer || tokenIds.length === 0) return "";
  return cachedTokenizer.decode(tokenIds);
}

export function multilingualTokenize(text: string): string[] {
  if (!cachedTokenizer || !text) return fallbackTokenize(text);

  const tokenIds: number[] = cachedTokenizer.encode(text);
  const tokens: string[] = [];
  for (const id of tokenIds) {
    const piece = cachedTokenizer.model.config.id_to_token?.[id] || `<${id}>`;
    tokens.push(piece);
  }
  return tokens;
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
    vocabSize: cachedTokenizer?.model?.config?.vocab_size ?? 0,
  };
}
