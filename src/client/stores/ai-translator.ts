import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { translationCache } from "~/client/utils/translation-cache";

export const [currentLang, setCurrentLang] = createSignal<string>(
  typeof window !== "undefined" ? localStorage.getItem("lang") || "vi" : "vi",
);

// Store to hold translations: { lang: { key: translated_text } }
export const [translations, setTranslations] = createStore<Record<string, Record<string, string>>>({
  en: {},
  zh: {},
  ja: {},
  fi: {},
  he: {},
});

export function setLanguage(lang: string) {
  setCurrentLang(lang);
  if (typeof window !== "undefined") {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    if (lang === "he") {
      document.documentElement.dir = "rtl";
    } else {
      document.documentElement.dir = "ltr";
    }
  }
}

let idbReady = false;

export async function initTranslationCache(): Promise<void> {
  if (typeof window === "undefined") return;

  await translationCache.init();

  for (const lang of ["en", "zh", "ja", "fi", "he"]) {
    const raw = localStorage.getItem(`translations_${lang}`);
    if (raw) {
      try {
        const data: Record<string, string> = JSON.parse(raw);
        const entries = Object.entries(data).map(([text, translation]) => ({ text, lang, translation }));
        if (entries.length > 0) {
          await translationCache.putBulk(entries);
        }
      } catch {}
      localStorage.removeItem(`translations_${lang}`);
    }

    const map = await translationCache.getBulk(lang);
    if (map.size > 0) {
      setTranslations(lang, Object.fromEntries(map));
    }
  }

  idbReady = true;
}

// Queue for batching translation requests
let translationQueue: Set<string> = new Set();
let debounceTimeout: any = null;

async function processTranslationQueue(lang: string) {
  if (translationQueue.size === 0) return;

  const textsToTranslate = Array.from(translationQueue);
  translationQueue.clear();

  try {
    const res = await fetch("/api/translate-dynamic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: textsToTranslate, targetLang: lang }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.translations) {
        setTranslations(lang, (prev) => ({ ...prev, ...data.translations }));
        if (idbReady) {
          const entries = Object.entries(data.translations).map(([text, translation]) => ({
            text,
            lang,
            translation: translation as string,
          }));
          translationCache.putBulk(entries).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error("Dynamic translation failed:", error);
  }
}

function requestTranslation(key: string, lang: string) {
  if (!translations[lang]?.[key]) {
    translationQueue.add(key);

    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      processTranslationQueue(lang);
    }, 100);
  }
}

function loadTranslationsCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`translations_${lang}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTranslationsCache(lang: string, data: Record<string, string>) {
  try {
    const existing = loadTranslationsCache(lang);
    const merged = { ...existing, ...data };
    localStorage.setItem(`translations_${lang}`, JSON.stringify(merged));
  } catch {}
}

export function t(key: string): string {
  if (!key) return "";

  const lang = currentLang();
  if (lang === "vi") return key; // Default is Vietnamese

  // Return cached translation if available
  if (translations[lang]?.[key]) {
    return translations[lang][key];
  }

  // Request dynamic translation
  if (typeof window !== "undefined") {
    requestTranslation(key, lang);
  }

  // Return original text as placeholder while translating
  return key;
}

export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  if (typeof num !== "number") return "0";
  const lang = currentLang();
  try {
    return new Intl.NumberFormat(lang, options).format(num);
  } catch (e) {
    return new Intl.NumberFormat("en-US", options).format(num);
  }
}

export function currencySymbol(): string {
  switch (currentLang()) {
    case "en":
      return "$";
    case "zh":
    case "ja":
      return "¥";
    case "fi":
      return "€";
    case "he":
      return "₪";
    default:
      return "₫";
  }
}

const [exchangeRates, setExchangeRates] = createSignal<Record<string, number>>({});

async function fetchExchangeRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/VND");
    const data = await res.json();
    if (data && data.rates) {
      const rates = data.rates;
      const computedRates: Record<string, number> = {
        VND: 1,
        USD: rates.USD || 0,
        CNY: rates.CNY || 0,
        JPY: rates.JPY || 0,
        EUR: rates.EUR || 0,
        ILS: rates.ILS || 0,
      };
      setExchangeRates(computedRates);
    }
  } catch (e) {
    console.error("Failed to fetch exchange rates", e);
  }
}

if (typeof window !== "undefined") {
  fetchExchangeRates();
}

export function formatCurrency(num: number, options?: Intl.NumberFormatOptions): string {
  if (typeof num !== "number") return "0";
  const lang = currentLang();
  let convertedNum = num;

  if (lang !== "vi") {
    let targetCode = "USD";
    switch (lang) {
      case "en":
        targetCode = "USD";
        break;
      case "zh":
        targetCode = "CNY";
        break;
      case "ja":
        targetCode = "JPY";
        break;
      case "fi":
        targetCode = "EUR";
        break;
      case "he":
        targetCode = "ILS";
        break;
    }
    const rates = exchangeRates();
    if (rates && rates[targetCode]) {
      convertedNum = num * rates[targetCode];
    }
  }

  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 2, ...options }).format(convertedNum);
  } catch (e) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, ...options }).format(convertedNum);
  }
}
