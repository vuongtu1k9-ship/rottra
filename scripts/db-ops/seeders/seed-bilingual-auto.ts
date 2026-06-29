import { db } from "../../../src/infra/database/db-pool";
import { vietnameseLexicon, bilingualCorpus } from "../../../src/infra/database/schema";
import crypto from "crypto";

// Helper function to call the free Google Translate API
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json();
      // Extract translated parts and join them (handling multi-line or long responses)
      if (data && data[0]) {
        return data[0].map((x: any) => x[0]).join("");
      }
    }
  } catch (err) {
    console.error(`Error translating to ${targetLang}:`, err);
  }
  return "";
}

async function main() {
  console.log("🌐 Starting Automatic Multilingual Seeder (Vietnamese -> 5 Languages)...");
  console.log("══════════════════════════════════════════════════════════════════════");

  // Get all lexicons from database
  const lexicons = await db.select().from(vietnameseLexicon);
  console.log(`Found ${lexicons.length} Vietnamese lexicon records.`);

  const targetLangs = ["en", "zh", "ja", "fi", "he"];
  let count = 0;

  for (const lex of lexicons) {
    // Generate a clean sentence/phrase to translate
    // We combine the word and its definition to give Google Translate good semantic context
    const viText = `${lex.word}: ${lex.definition || ""}`;

    console.log(`\nTranslating [${lex.word}]...`);

    const translations: Record<string, string> = { vi: viText };
    for (const lang of targetLangs) {
      // Small delay to prevent Google from blocking IP
      await new Promise((resolve) => setTimeout(resolve, 300));
      const translated = await translateText(viText, lang);
      translations[lang] = translated || "";
      console.log(`  => [${lang.toUpperCase()}]: ${translated ? (translated.length > 50 ? translated.substring(0, 50) + "..." : translated) : "FAIL"}`);
    }

    try {
      const id = `bi_auto_${lex.id || crypto.randomUUID().split("-")[0]}`;
      await db.insert(bilingualCorpus).values({
        id,
        vi: translations.vi,
        en: translations.en || null,
        zh: translations.zh || null,
        ja: translations.ja || null,
        fi: translations.fi || null,
        he: translations.he || null,
        addAt: new Date().toISOString(),
      }).onConflictDoNothing();
      count++;
    } catch (e: any) {
      console.error(`Failed to insert ${lex.word} translation:`, e.message);
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`🎉 Completed! Successfully populated ${count} multilingual records to BilingualCorpus!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
