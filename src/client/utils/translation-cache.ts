interface TranslationRecord {
  id: string;
  text: string;
  lang: string;
  translation: string;
  updatedAt: number;
}

interface BulkEntry {
  text: string;
  lang: string;
  translation: string;
}

function makeKey(text: string, lang: string): string {
  return `${text}\0${lang}`;
}

class TranslationCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("rottra-translations", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("translations")) {
            const store = db.createObjectStore("translations", { keyPath: "id" });
            store.createIndex("by_lang", "lang", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.db = null;
    }
  }

  async get(text: string, lang: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction("translations", "readonly");
        const req = tx.objectStore("translations").get(makeKey(text, lang));
        req.onsuccess = () => resolve(req.result?.translation ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async getBulk(lang: string): Promise<Map<string, string>> {
    if (!this.db) return new Map();
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction("translations", "readonly");
        const idx = tx.objectStore("translations").index("by_lang");
        const range = IDBKeyRange.only(lang);
        const map = new Map<string, string>();
        const req = idx.openCursor(range);
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            map.set(cursor.value.text, cursor.value.translation);
            cursor.continue();
          } else {
            resolve(map);
          }
        };
        req.onerror = () => resolve(map);
      } catch {
        resolve(new Map());
      }
    });
  }

  async put(text: string, lang: string, translation: string): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction("translations", "readwrite");
      tx.objectStore("translations").put({
        id: makeKey(text, lang),
        text,
        lang,
        translation,
        updatedAt: Date.now(),
      });
    } catch {}
  }

  async putBulk(entries: BulkEntry[]): Promise<void> {
    if (!this.db || entries.length === 0) return;
    try {
      const tx = this.db.transaction("translations", "readwrite");
      const store = tx.objectStore("translations");
      const now = Date.now();
      for (const entry of entries) {
        store.put({
          id: makeKey(entry.text, entry.lang),
          text: entry.text,
          lang: entry.lang,
          translation: entry.translation,
          updatedAt: now,
        });
      }
    } catch {}
  }

  async has(text: string, lang: string): Promise<boolean> {
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction("translations", "readonly");
        const req = tx.objectStore("translations").count(makeKey(text, lang));
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async stats(lang: string): Promise<number> {
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction("translations", "readonly");
        const idx = tx.objectStore("translations").index("by_lang");
        const req = idx.count(IDBKeyRange.only(lang));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }
}

export const translationCache = new TranslationCache();
