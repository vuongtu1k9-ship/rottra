import { createSignal } from "solid-js";
import { translationCache } from "./translation-cache";

export const [isTranslating, setIsTranslating] = createSignal(false);
export const [translateProgress, setTranslateProgress] = createSignal(0);
export const [translatedLang, setTranslatedLang] = createSignal<string | null>(null);

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

const BATCH_SIZE = 40;

let currencyRates: Record<string, number> | null = null;
const CURRENCY_MAP: Record<string, string> = {
  en: "USD",
  ja: "JPY",
  ko: "KRW",
  zh: "CNY",
  fr: "EUR",
  de: "EUR",
  es: "EUR",
  ru: "RUB",
  th: "THB",
  id: "IDR",
  ms: "MYR",
  tl: "PHP",
};

const priceRegex =
  /((?:\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?)\s*(?:₫|VNĐ|VND)|(?:₫|VNĐ|VND)\s*((?:\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?)/i;

const DEFAULT_CURRENCY_RATES = {
  USD: 0.000041,
  EUR: 0.000038,
  RUB: 0.0037,
  THB: 0.0014,
  IDR: 0.65,
  MYR: 0.00019,
  PHP: 0.0023,
  JPY: 0.0064,
  CNY: 0.0003,
  VND: 1,
};

async function fetchCurrencyRates() {
  if (currencyRates) return;
  try {
    const res = await fetch("/api/exchange-rate");
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const data = await res.json();
      if (data.success && data.rates) {
        currencyRates = data.rates;
        return;
      }
    }
  } catch (e) {
    console.error("[PageTranslator] Failed to fetch currency rates:", e);
  }
  currencyRates = DEFAULT_CURRENCY_RATES;
}

function processCurrencyNode(record: TextNodeRecord, targetLang: string, rates: Record<string, number> | null): boolean {
  if (!rates) return false;
  const targetCurrency = CURRENCY_MAP[targetLang];
  if (!targetCurrency || !rates[targetCurrency]) return false;

  const originalTrimmed = record.node.textContent?.trim() || "";
  const match = originalTrimmed.match(priceRegex);

  if (match) {
    const numStr = match[1] || match[2];
    if (!numStr) return false;

    // In VN, dots or commas are often thousands separators, but if there's only one dot at the end it might be decimals.
    // For simplicity, strip all dots and commas (assuming no fractional VND).
    const num = Number(numStr.replace(/[.,]/g, ""));
    if (!isNaN(num)) {
      const rate = rates[targetCurrency];
      const converted = num * rate;
      const formatted = new Intl.NumberFormat(targetLang, { style: "currency", currency: targetCurrency }).format(converted);

      const original = record.node.textContent || "";
      const leadingSpace = original.match(/^(\s*)/)?.[1] || "";
      const trailingSpace = original.match(/(\s*)$/)?.[1] || "";

      record.node.textContent = leadingSpace + originalTrimmed.replace(priceRegex, formatted) + trailingSpace;
      return true;
    }
  }
  return false;
}

interface TextNodeRecord {
  node: Text;
  original: string;
  element: HTMLElement;
}

let savedNodes: TextNodeRecord[] = [];
let activeController: AbortController | null = null;
let observer: MutationObserver | null = null;

function collectTextNodes(root: Node): TextNodeRecord[] {
  const nodes: TextNodeRecord[] = [];
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
    if (text.length >= 2) {
      nodes.push({
        node: current as Text,
        original: current.textContent || "",
        element: current.parentElement as HTMLElement,
      });
    }
  }
  return nodes;
}

function applyTranslations(records: TextNodeRecord[], translationsMap: Record<string, string>) {
  for (const record of records) {
    if (!record.node.parentElement) continue;
    const originalTrimmed = record.node.textContent?.trim() || "";
    if (translationsMap[originalTrimmed]) {
      const translated = translationsMap[originalTrimmed];
      const original = record.node.textContent || "";
      const leadingSpace = original.match(/^(\s*)/)?.[1] || "";
      const trailingSpace = original.match(/(\s*)$/)?.[1] || "";
      record.node.textContent = leadingSpace + translated + trailingSpace;
    }
  }
}

let isTranslationServiceAvailable = true;
if (typeof window !== "undefined") {
  try {
    if (sessionStorage.getItem("rottra_translation_disabled") === "true") {
      isTranslationServiceAvailable = false;
    }
  } catch {}
}

async function translateBatch(texts: string[], targetLang: string): Promise<Record<string, string>> {
  if (!isTranslationServiceAvailable) return {};
  try {
    const res = await fetch("/api/translate-dynamic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, targetLang }),
    });
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const data = await res.json();
      if (data.success && data.translations) {
        return data.translations;
      }
    } else {
      if (res.status === 405 || res.status === 404 || !res.headers.get("content-type")?.includes("application/json")) {
        console.warn("[PageTranslator] Translation service is not available (static host). Disabling batch requests.");
        isTranslationServiceAvailable = false;
        try {
          sessionStorage.setItem("rottra_translation_disabled", "true");
        } catch {}
      }
    }
  } catch (err) {
    console.error("[PageTranslator] Batch translate error:", err);
    isTranslationServiceAvailable = false;
    try {
      sessionStorage.setItem("rottra_translation_disabled", "true");
    } catch {}
  }
  return {};
}

function translateNewNodes(root: HTMLElement, lang: string) {
  const nodes = collectTextNodes(root);
  if (nodes.length === 0) return;

  const uniqueTexts = [...new Set(nodes.map((n) => n.node.textContent?.trim() || ""))];

  (async () => {
    await fetchCurrencyRates();
    const translations: Record<string, string> = {};
    const misses: string[] = [];

    // First handle currency conversions directly without API
    const textNodesToTranslate: TextNodeRecord[] = [];
    for (const record of nodes) {
      if (!processCurrencyNode(record, lang, currencyRates)) {
        textNodesToTranslate.push(record);
      }
    }

    const remainingUniqueTexts = [...new Set(textNodesToTranslate.map((n) => n.node.textContent?.trim() || ""))];

    for (const text of remainingUniqueTexts) {
      const cached = await translationCache.get(text, lang);
      if (cached) {
        translations[text] = cached;
      } else {
        misses.push(text);
      }
    }

    applyTranslations(textNodesToTranslate, translations);

    if (misses.length > 0) {
      for (let i = 0; i < misses.length; i += BATCH_SIZE) {
        const batch = misses.slice(i, i + BATCH_SIZE);
        const result = await translateBatch(batch, lang);
        if (Object.keys(result).length > 0) {
          await translationCache.putBulk(Object.entries(result).map(([text, translation]) => ({ text, lang, translation })));
          applyTranslations(textNodesToTranslate, result);
        }
      }
    }
  })();
}

export function startWatchingDOM(): void {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((mutations) => {
    const lang = translatedLang();
    if (!lang) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          translateNewNodes(node as HTMLElement, lang);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function stopWatchingDOM(): void {
  observer?.disconnect();
  observer = null;
}

export async function translatePage(targetLang: string): Promise<void> {
  if (targetLang === "vi") {
    restorePage();
    return;
  }

  if (translatedLang() !== null) {
    restorePage();
    await new Promise((r) => setTimeout(r, 50));
  }

  activeController?.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  setIsTranslating(true);
  setTranslateProgress(0);
  setTranslatedLang(targetLang);

  const textNodes = collectTextNodes(document.body);
  savedNodes = textNodes;

  await fetchCurrencyRates();

  const textNodesToTranslate: TextNodeRecord[] = [];
  for (const record of textNodes) {
    if (!processCurrencyNode(record, targetLang, currencyRates)) {
      textNodesToTranslate.push(record);
    }
  }

  const uniqueTexts = [...new Set(textNodesToTranslate.map((n) => n.node.textContent?.trim() || ""))];

  const cachedTranslations: Record<string, string> = {};
  const cacheMisses: string[] = [];

  for (const text of uniqueTexts) {
    if (signal.aborted) return;
    const cached = await translationCache.get(text, targetLang);
    if (cached) {
      cachedTranslations[text] = cached;
    } else {
      cacheMisses.push(text);
    }
  }

  applyTranslations(textNodesToTranslate, cachedTranslations);
  setTranslateProgress(uniqueTexts.length > 0 ? Math.round((Object.keys(cachedTranslations).length / uniqueTexts.length) * 30) : 0);

  if (cacheMisses.length > 0) {
    const allNewTranslations: Record<string, string> = {};
    for (let i = 0; i < cacheMisses.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = cacheMisses.slice(i, i + BATCH_SIZE);
      const result = await translateBatch(batch, targetLang);
      Object.assign(allNewTranslations, result);

      if (Object.keys(result).length > 0) {
        await translationCache.putBulk(Object.entries(result).map(([text, translation]) => ({ text, lang: targetLang, translation })));
      }

      const done = Object.keys(cachedTranslations).length + i + batch.length;
      setTranslateProgress(Math.min(100, Math.round((done / uniqueTexts.length) * 100)));
    }
    applyTranslations(textNodesToTranslate, allNewTranslations);
  }

  setIsTranslating(false);
  setTranslateProgress(100);

  startWatchingDOM();
}

export function restorePage(): void {
  activeController?.abort();
  stopWatchingDOM();

  for (const record of savedNodes) {
    if (record.node.parentElement) {
      record.node.textContent = record.original;
    }
  }
  savedNodes = [];
  setIsTranslating(false);
  setTranslateProgress(0);
  setTranslatedLang(null);
}
