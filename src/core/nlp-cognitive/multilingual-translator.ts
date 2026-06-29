import { fetch } from "bun";

export interface ParsedTranslation {
  isTranslation: boolean;
  textToTranslate: string;
  targetLangCode: string;
  targetLangName: string;
  sourceLangCode: string;
}

const LANGUAGES = [
  { codes: ["tiếng nhật", "nhật bản", "nhật", "japanese", "ja"], code: "ja", name: "Tiếng Nhật" },
  { codes: ["tiếng anh", "anh", "english", "en"], code: "en", name: "Tiếng Anh" },
  { codes: ["tiếng trung", "tiếng hoa", "trung quốc", "trung", "chinese", "zh"], code: "zh", name: "Tiếng Trung" },
  { codes: ["tiếng hebrew", "tiếng do thái", "do thái", "hebrew", "he"], code: "he", name: "Tiếng Hebrew" },
  { codes: ["tiếng phần lan", "phần lan", "finnish", "fi"], code: "fi", name: "Tiếng Phần Lan" },
  { codes: ["tiếng việt nam", "tiếng việt", "việt nam", "việt", "vietnamese", "vi"], code: "vi", name: "Tiếng Việt" },
];

const SORTED_ALIASES = LANGUAGES.flatMap((lang) => lang.codes.map((alias) => ({ alias, lang }))).sort(
  (a, b) => b.alias.length - a.alias.length,
);

export function parseTranslationQuery(query: string): ParsedTranslation | null {
  const q = query.trim().toLowerCase();

  const triggers = [
    "biên dịch",
    "dịch thuật",
    "chuyển ngữ",
    "nghĩa là gì",
    "phát âm",
    "translate",
    "translation",
    "how to say",
    "pronounce",
    "翻译",
    "意思是",
    "怎么说",
    "译",
    "翻訳",
    "どう言う",
    "意味",
    "訳",
    "käännä",
    "käännös",
    "mitä tarkoittaa",
    "kuinka sanotaan",
    "תרגם",
    "תרגום",
    "איך אומרים",
    "מה זה אומר",
    "פירוש",
  ];

  const hasDich = /(?<!giao\s+|chiến\s+|thể\s+|chế\s+|tự\s+)\bdịch\b(?!\s+vụ|\s+bệnh|\s+tễ|\s+vị|\s+tả|\s+hạch)/i.test(q);
  const hasTrigger =
    hasDich ||
    triggers.some((t) => q.includes(t)) ||
    q.includes("sang tiếng") ||
    q.includes("qua tiếng") ||
    (q.includes("tiếng") && (q.includes("của") || q.includes("là gì")));

  if (!hasTrigger) return null;

  let targetLang: (typeof LANGUAGES)[0] | null = null;
  let sourceLang: (typeof LANGUAGES)[0] | null = null;

  const matchAlias = (searchStr: string, alias: string): boolean => {
    if (/^[a-z0-9]+$/i.test(alias) && alias.length <= 4) {
      const regex = new RegExp(`\\b${alias}\\b`, "i");
      return regex.test(searchStr);
    }
    return searchStr.includes(alias);
  };

  const targetKeywords = ["sang tiếng", "qua tiếng", "sang", "qua", "to", "into", "in"];
  for (const kw of targetKeywords) {
    const kwIdx = q.indexOf(kw);
    if (kwIdx !== -1) {
      const afterKw = q.slice(kwIdx + kw.length).trim();
      for (const item of SORTED_ALIASES) {
        const boundaryAlias = /^[a-z0-9]+$/i.test(item.alias) && item.alias.length <= 4 ? `\\b${item.alias}\\b` : `^${item.alias}`;
        const regex = new RegExp(boundaryAlias, "i");
        if (regex.test(afterKw)) {
          targetLang = item.lang;
          break;
        }
      }
      if (targetLang) break;
    }
  }

  if (!targetLang) {
    for (const item of SORTED_ALIASES) {
      if (matchAlias(q, `${item.alias} của`) || matchAlias(q, `tiếng ${item.alias} của`)) {
        targetLang = item.lang;
        break;
      }
    }
  }

  if (!targetLang) {
    for (const item of SORTED_ALIASES) {
      if (matchAlias(q, item.alias)) {
        targetLang = item.lang;
        break;
      }
    }
  }

  if (!targetLang) {
    const hasAccents = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/.test(query);
    targetLang = hasAccents ? LANGUAGES.find((l) => l.code === "en")! : LANGUAGES.find((l) => l.code === "vi")!;
  }

  const sourceKeywords = ["từ tiếng", "từ", "from"];
  for (const kw of sourceKeywords) {
    const kwIdx = q.indexOf(kw);
    if (kwIdx !== -1) {
      const afterKw = q.slice(kwIdx + kw.length).trim();
      for (const item of SORTED_ALIASES) {
        if (matchAlias(afterKw, item.alias) && item.lang !== targetLang) {
          sourceLang = item.lang;
          break;
        }
      }
      if (sourceLang) break;
    }
  }

  let cleaned = query;

  const escapedTriggers = triggers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const startTriggerRegex = new RegExp(`^(${escapedTriggers.join("|")})\\s*`, "i");
  cleaned = cleaned.replace(startTriggerRegex, "");

  if (targetLang) {
    for (const alias of targetLang.codes) {
      for (const kw of targetKeywords) {
        cleaned = cleaned.replace(new RegExp(`${kw}\\s+${alias}`, "gi"), "");
      }
      cleaned = cleaned.replace(new RegExp(`tiếng\\s+${alias}\\s+của`, "gi"), "");
      cleaned = cleaned.replace(new RegExp(`tiếng\\s+${alias}\\s+là\\s+gì`, "gi"), "");
      cleaned = cleaned.replace(new RegExp(`${alias}\\s+của`, "gi"), "");
      cleaned = cleaned.replace(new RegExp(`${alias}\\s+là\\s+gì`, "gi"), "");
      cleaned = cleaned.replace(new RegExp(`trong\\s+tiếng\\s+${alias}`, "gi"), "");
      cleaned = cleaned.replace(new RegExp(`in\\s+${alias}`, "gi"), "");
    }
  }

  if (sourceLang) {
    for (const alias of sourceLang.codes) {
      for (const kw of sourceKeywords) {
        cleaned = cleaned.replace(new RegExp(`${kw}\\s+${alias}`, "gi"), "");
      }
    }
  }

  const fluff = ["câu này", "câu sau", "như thế nào", "như nào", "của", "là gì"];
  for (const f of fluff) {
    cleaned = cleaned.replace(new RegExp(f, "gi"), "");
  }

  let textToTranslate = cleaned
    .trim()
    .replace(/^[:,\s.-]+|[:,\s.-]+$/g, "")
    .replace(/^['":`""''\s\(\)]+|['":`""''\s\(\)]+$/g, "")
    .trim();

  if (!textToTranslate) {
    const fallbackRegex = new RegExp(`^(${escapedTriggers.join("|")})\\s*`, "i");
    textToTranslate = query.replace(fallbackRegex, "").trim();
  }

  return {
    isTranslation: true,
    textToTranslate,
    targetLangCode: targetLang.code,
    targetLangName: targetLang.name,
    sourceLangCode: sourceLang ? sourceLang.code : "auto",
  };
}

export async function translateText(text: string, targetLang: string, sourceLang = "auto"): Promise<string> {
  try {
    const { aiTranslator } = await import("./ai-translator");
    return await aiTranslator.translate(text, targetLang, sourceLang);
  } catch (err: any) {
    console.error("[MultilingualTranslator] Local translate error:", err.message);
    return text;
  }
}

export interface TranslationResult {
  translatedText: string;
  detectedLang: string;
}

export async function translateWithDetection(text: string, targetLang: string, sourceLang = "auto"): Promise<TranslationResult> {
  try {
    const { aiTranslator } = await import("./ai-translator");
    return await aiTranslator.translateWithFallback(text, targetLang, sourceLang);
  } catch (err: any) {
    console.error("[MultilingualTranslator] Local translateWithDetection error:", err.message);
    const { aiTranslator: localTranslator } = await import("./ai-translator");
    return {
      translatedText: text,
      detectedLang: localTranslator.detectLanguageOffline(text),
    };
  }
}
