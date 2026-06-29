import { checkSemanticCache, writeSemanticCache } from "~/core/neural-memory/semantic-cache";

// Simple in-memory cache specifically for External APIs (TTL 24 hours)
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachedData(key: string) {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

// 1. Wikipedia API - Tri thức miễn phí
export const fetchWikipediaSummary = async (title: string): Promise<string | null> => {
  const cleanTitle = title.replace(/\s+/g, "_");
  const cacheKey = `wiki_${cleanTitle}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        "User-Agent": "RottraAI/1.0 (admin@rottra.vn)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const summary = data.extract || null;
    if (summary) setCachedData(cacheKey, summary);
    return summary;
  } catch (e) {
    return null;
  }
};

// 2. Wikidata API - CSDL kiến thức có cấu trúc
export const fetchWikidataEntity = async (searchQuery: string): Promise<any | null> => {
  const cacheKey = `wikidata_${searchQuery}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchQuery)}&language=en&format=json`,
      {
        signal: AbortSignal.timeout(3000),
        headers: { "User-Agent": "RottraAI/1.0" },
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.search && data.search.length > 0) {
      setCachedData(cacheKey, data.search[0]);
      return data.search[0];
    }
    return null;
  } catch (e) {
    return null;
  }
};

// 3. Open Library API - Sách nông nghiệp
export const fetchOpenLibrary = async (topic: string): Promise<any | null> => {
  const cacheKey = `openlib_${topic}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&limit=3`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.docs && data.docs.length > 0) {
      const docs = data.docs.map((d: any) => ({ title: d.title, author: d.author_name?.[0], year: d.first_publish_year }));
      setCachedData(cacheKey, docs);
      return docs;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// 4. Weatherstack - Dự báo thời tiết nông nghiệp
export const fetchWeatherstack = async (location: string): Promise<string | null> => {
  const apiKey = process.env.WEATHERSTACK_API_KEY;
  if (!apiKey) {
    return `[Mock Weather] Hiện tại không có API Key Weatherstack. Giả lập thời tiết tại ${location}: Nắng đẹp, 32°C, độ ẩm 65%. Thích hợp phơi nông sản.`;
  }

  const cacheKey = `weather_${location}`;
  // Weather should only cache for 1 hour
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) return cached.data;

  try {
    const res = await fetch(`https://api.weatherstack.com/current?access_key=${apiKey}&query=${encodeURIComponent(location)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.current) {
      const result = `Thời tiết tại ${data.location.name}: ${data.current.weather_descriptions[0]}, Nhiệt độ: ${data.current.temperature}°C, Cảm giác như: ${data.current.feelslike}°C, Độ ẩm: ${data.current.humidity}%, Gió: ${data.current.wind_speed} km/h.`;
      setCachedData(cacheKey, result);
      return result;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// 5. DuckDuckGo Instant Answer - Tìm kiếm miễn phí, không cần API key
export const searchDuckDuckGo = async (query: string): Promise<{ abstract: string; relatedTopics: string[]; url: string } | null> => {
  const cacheKey = `ddg_${query.toLowerCase().replace(/\s+/g, "_")}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "RottraAI/1.0" },
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();

    const abstract = data.AbstractText || data.Answer || "";
    const relatedTopics = (data.RelatedTopics || [])
      .filter((t: any) => t.Text)
      .slice(0, 5)
      .map((t: any) => t.Text);
    const url = data.AbstractURL || "";

    if (!abstract && relatedTopics.length === 0) return null;

    const result = { abstract, relatedTopics, url };
    setCachedData(cacheKey, result);
    return result;
  } catch (e) {
    return null;
  }
};

// 6. Wikipedia Search API - Tìm kiếm bài viết liên quan
export const searchWikipedia = async (query: string, lang: string = "vi"): Promise<Array<{ title: string; snippet: string; url: string }> | null> => {
  const cacheKey = `wiki_search_${lang}_${query.toLowerCase().replace(/\s+/g, "_")}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`,
      {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "RottraAI/1.0" },
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();

    if (data.query?.search) {
      const results = data.query.search.map((r: any) => ({
        title: r.title,
        snippet: r.snippet?.replace(/<[^>]*>/g, "") || "",
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
      }));
      setCachedData(cacheKey, results);
      return results;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// 7. Wiktionary - Tra cứu từ điển tiếng Việt
export const fetchWiktionary = async (word: string, lang: string = "vi"): Promise<string | null> => {
  const cacheKey = `wiktionary_${lang}_${word}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://${lang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      {
        signal: AbortSignal.timeout(3000),
        headers: { "User-Agent": "RottraAI/1.0" },
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();

    // Extract Vietnamese definitions
    const viDefs = data.vi || data.en || [];
    if (Array.isArray(viDefs) && viDefs.length > 0) {
      const def = viDefs[0].definitions?.[0]?.definition || viDefs[0].text || "";
      const cleaned = def.replace(/<[^>]*>/g, "").trim();
      if (cleaned) {
        setCachedData(cacheKey, cleaned);
        return cleaned;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

// 8. CurrencyFreaks - Tỷ giá hạt điều, cà phê
export const fetchCurrencyFreaks = async (symbols = "VND,USD,EUR"): Promise<string | null> => {
  const apiKey = process.env.CURRENCYFREAKS_API_KEY;
  if (!apiKey) {
    return `[Mock Currency] Tỷ giá giả lập: 1 USD = 25,400 VND. Giá Cà phê tham khảo: 110,000 VND/kg. Giá Hạt điều tham khảo: 45,000 VND/kg.`;
  }

  const cacheKey = `currency_${symbols}`;
  // Currency should cache for 6 hours
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 6 * 3600000) return cached.data;

  try {
    const res = await fetch(`https://api.currencyfreaks.com/latest?apikey=${apiKey}&symbols=${encodeURIComponent(symbols)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.rates) {
      const result = `Tỷ giá tham chiếu (USD cơ sở): VND: ${data.rates.VND}, EUR: ${data.rates.EUR}.`;
      setCachedData(cacheKey, result);
      return result;
    }
    return null;
  } catch (e) {
    return null;
  }
};
