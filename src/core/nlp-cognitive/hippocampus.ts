import * as path from "node:path";
import { checkSemanticCache, writeSemanticCache } from "~/core/neural-memory/semantic-cache";

function cleanTextLocal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeAccentsLocal(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export class Hippocampus {
  private static cachedGenerativeModel: any = null;
  private static lastModelCheckTime = 0;

  /**
   * Truy xuất Episodic Memory (Ký ức sự kiện ngắn hạn - Cache)
   */
  public static recallEpisodicMemory(botId: string, userPrompt: string): string | null {
    return checkSemanticCache(botId, userPrompt);
  }

  public static storeEpisodicMemory(botId: string, userPrompt: string, response: string): void {
    writeSemanticCache(botId, userPrompt, response);
  }

  /**
   * Truy xuất Semantic Memory (Kiến thức ngữ nghĩa dài hạn - TF-IDF)
   */
  public static async recallSemanticMemory(userPrompt: string): Promise<{ response: string; score: number } | null> {
    const modelPath = path.join(process.cwd(), "finetune", "data", "rottra_generative_model.json");

    if (!this.cachedGenerativeModel || Date.now() - this.lastModelCheckTime > 5000) {
      this.lastModelCheckTime = Date.now();
      const file = Bun.file(modelPath);
      if (await file.exists()) {
        try {
          this.cachedGenerativeModel = await file.json();
        } catch (e) {
          console.error("[Hippocampus] Error loading semantic memory:", e);
        }
      }
    }

    if (!this.cachedGenerativeModel) return null;

    const { idf, documents } = this.cachedGenerativeModel;
    const cleanPrompt = cleanTextLocal(userPrompt);
    const noAccentPrompt = removeAccentsLocal(cleanPrompt);

    const promptTokens = Array.from(new Set([...cleanPrompt.split(" "), ...noAccentPrompt.split(" ")])).filter((t) => t.length > 0);
    if (promptTokens.length === 0) return null;

    const tf: Record<string, number> = {};
    for (const token of promptTokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    const promptVector: Record<string, number> = {};
    let promptSumSquares = 0;

    for (const token of promptTokens) {
      if (idf[token]) {
        const tfidf = tf[token] * idf[token];
        promptVector[token] = tfidf;
        promptSumSquares += tfidf * tfidf;
      }
    }

    const promptVectorLength = Math.sqrt(promptSumSquares);
    if (promptVectorLength === 0) return null;

    let bestDoc: any = null;
    let bestScore = -1;

    for (const doc of documents) {
      let dotProduct = 0;
      for (const term in promptVector) {
        if (doc.vector[term]) {
          dotProduct += promptVector[term] * doc.vector[term];
        }
      }

      const similarity = dotProduct / (promptVectorLength * doc.vectorLength);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestDoc = doc;
      }
    }

    if (bestDoc && bestScore >= 0.25) {
      return { response: bestDoc.response, score: bestScore };
    }

    return null;
  }

  /**
   * Truy xuất Sở thích Người dùng (Personalized Awareness)
   */
  public static async getUserPreference(userId: string): Promise<string | null> {
    if (!userId) return null;
    const profilePath = path.join(process.cwd(), "finetune", "data", "user_profiles.json");
    const file = Bun.file(profilePath);
    if (!(await file.exists())) return null;
    try {
      const data = await file.json();
      return data[userId] || null;
    } catch (e) {
      return null;
    }
  }

  public static async saveUserPreference(userId: string, preference: string): Promise<void> {
    if (!userId || !preference) return;
    const profilePath = path.join(process.cwd(), "finetune", "data", "user_profiles.json");
    const file = Bun.file(profilePath);
    let data: Record<string, string> = {};
    if (await file.exists()) {
      try {
        data = await file.json();
      } catch (e) {}
    }
    const currentPref = data[userId] || "";
    if (!currentPref.includes(preference)) {
      data[userId] = currentPref ? `${currentPref}. ${preference}` : preference;
      const fs = require("node:fs");
      const dir = path.dirname(profilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await Bun.write(profilePath, JSON.stringify(data, null, 2));
    }
  }
}
