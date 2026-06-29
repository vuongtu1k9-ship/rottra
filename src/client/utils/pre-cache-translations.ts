import { translationCache } from "./translation-cache";

const TARGET_LANGS = ["en", "zh", "ja", "fi", "he"] as const;
const BATCH_SIZE = 40;

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "SVG",
  "MATH",
  "IMG",
  "INPUT",
  "SELECT",
  "OPTION",
  "IFRAME",
  "CANVAS",
  "VIDEO",
  "AUDIO",
]);

let activeController: AbortController | null = null;

function collectAllTexts(root: Node): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[contenteditable='true']")) return NodeFilter.FILTER_REJECT;
      const text = node.textContent?.trim();
      if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;
      if (/^[\d\s\.,\-+:;/\\=%$#@!&*(){}\[\]<>|~`'"?^_]+$/.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current: Node | null;
  while ((current = walker.nextNode())) {
    const text = current.textContent?.trim() || "";
    if (text.length >= 2 && !seen.has(text)) {
      seen.add(text);
      texts.push(text);
    }
  }
  return texts;
}

async function translateBatch(texts: string[], targetLang: string): Promise<Record<string, string>> {
  try {
    const res = await fetch("/api/translate-dynamic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, targetLang }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.translations) {
        return data.translations;
      }
    }
  } catch {}
  return {};
}

export async function preCacheTranslations(): Promise<void> {
  if (typeof window === "undefined") return;

  activeController?.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  const texts = collectAllTexts(document.body);
  if (texts.length === 0) return;

  for (const lang of TARGET_LANGS) {
    if (signal.aborted) return;

    const uncached: string[] = [];
    for (const text of texts) {
      if (signal.aborted) return;
      const cached = await translationCache.get(text, lang);
      if (!cached) uncached.push(text);
    }

    if (uncached.length === 0) continue;

    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const translations = await translateBatch(batch, lang);
      if (Object.keys(translations).length > 0) {
        await translationCache.putBulk(Object.entries(translations).map(([text, translation]) => ({ text, lang, translation })));
      }
    }
  }
}

export function cancelPreCache(): void {
  activeController?.abort();
}
