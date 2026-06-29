type LangCode = "vi" | "en" | "zh" | "ja" | "fi" | "he";

export interface TranslationResult {
  translatedText: string;
  detectedLang: string;
}

const SUPPORTED_LANGS = new Set<string>(["vi", "en", "zh", "ja", "fi", "he"]);
const TARGET_LANGS: LangCode[] = ["en", "zh", "ja", "fi", "he"];

const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;

class AITranslator {
  private static instance: AITranslator;
  private dictionaries: Record<string, Record<string, string>> = {};
  private loaded = false;
  private googleFailCount = 0;
  private googleCircuitOpen = false;
  private lastCircuitOpenTime = 0;

  private constructor() {}

  static getInstance(): AITranslator {
    if (!AITranslator.instance) {
      AITranslator.instance = new AITranslator();
    }
    return AITranslator.instance;
  }

  async loadDictionaries(): Promise<void> {
    if (this.loaded) return;

    for (const lang of TARGET_LANGS) {
      try {
        const resp = await fetch("/translations/" + lang + ".json");
        if (resp.ok) {
          this.dictionaries[lang] = await resp.json();
        }
      } catch {}
    }

    this.loaded = true;
  }

  detectLanguageOffline(text: string): string {
    const t = text.trim();
    if (!t) return "vi";
    if (/[\u0590-\u05FF]/.test(t)) return "he";
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(t)) return "ja";
    if (/[\u4e00-\u9fff]/.test(t)) return "zh";
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/.test(t)) return "vi";
    if (/[äöÄÖ]/.test(t)) return "fi";
    if (/^[a-zA-Z0-9\s.,!?'"\(\)\-\[\]]+$/.test(t)) return "en";
    return "vi";
  }

  private lookupInDictionary(text: string, targetLang: string): string | null {
    const dict = this.dictionaries[targetLang];
    if (!dict) return null;

    if (dict[text]) return dict[text];

    const lower = text.toLowerCase();
    for (const [key, value] of Object.entries(dict)) {
      if (key.toLowerCase() === lower) return value;
    }

    return null;
  }

  private reverseLookup(text: string, sourceLang: string): string | null {
    const dict = this.dictionaries[sourceLang];
    if (!dict) return null;

    const lower = text.toLowerCase();
    for (const [key, value] of Object.entries(dict)) {
      if (value.toLowerCase() === lower) return key;
    }

    return null;
  }

  private isCircuitOpen(): boolean {
    if (!this.googleCircuitOpen) return false;
    if (Date.now() - this.lastCircuitOpenTime > CIRCUIT_BREAKER_RESET_MS) {
      this.googleCircuitOpen = false;
      this.googleFailCount = 0;
      return false;
    }
    return true;
  }

  private recordGoogleFailure(): void {
    this.googleFailCount++;
    if (this.googleFailCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.googleCircuitOpen = true;
      this.lastCircuitOpenTime = Date.now();
      console.warn("[AITranslator] Circuit breaker OPEN — Google API failing");
    }
  }

  private recordGoogleSuccess(): void {
    this.googleFailCount = 0;
    this.googleCircuitOpen = false;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async callGoogleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (this.isCircuitOpen()) throw new Error("Circuit breaker open");

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = GOOGLE_URL + "?client=gtx&sl=" + sourceLang + "&tl=" + targetLang + "&dt=t&q=" + encodeURIComponent(text);
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        const result = data[0].map((item: any) => item[0]).join("");
        this.recordGoogleSuccess();
        return result;
      } catch (err: any) {
        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS * (attempt + 1));
        } else {
          this.recordGoogleFailure();
          throw err;
        }
      }
    }

    throw new Error("Google Translate failed after retries");
  }

  async translate(text: string, to: string, from: string = "auto"): Promise<string> {
    if (!SUPPORTED_LANGS.has(to)) throw new Error("Unsupported target: " + to);

    const sourceLang = from === "auto" ? this.detectLanguageOffline(text) : from;
    if (sourceLang === to) return text;

    const dictLookup = sourceLang === "vi" ? this.lookupInDictionary(text, to) : this.reverseLookup(text, sourceLang);
    if (dictLookup) return dictLookup;

    try {
      return await this.callGoogleTranslate(text, sourceLang, to);
    } catch {
      return text;
    }
  }

  async translateWithFallback(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    try {
      const from = sourceLang || "auto";
      const translatedText = await this.translate(text, targetLang, from);
      const detectedLang = from === "auto" ? this.detectLanguageOffline(text) : from;
      return { translatedText, detectedLang };
    } catch (err: any) {
      console.warn("[AITranslator] Translation failed:", err.message);
      const detectedLang = sourceLang === "auto" || !sourceLang ? this.detectLanguageOffline(text) : sourceLang;
      return { translatedText: text, detectedLang };
    }
  }

  async preload(): Promise<void> {
    await this.loadDictionaries();
  }

  loadedCount(): number {
    return Object.keys(this.dictionaries).length;
  }

  getStats(): { dictSize: number; googleFailCount: number; circuitOpen: boolean } {
    let dictSize = 0;
    for (const dict of Object.values(this.dictionaries)) {
      dictSize += Object.keys(dict).length;
    }
    return {
      dictSize,
      googleFailCount: this.googleFailCount,
      circuitOpen: this.googleCircuitOpen,
    };
  }
}

export const aiTranslator = AITranslator.getInstance();

if (typeof window !== "undefined") {
  aiTranslator.preload().catch(() => {});
}
