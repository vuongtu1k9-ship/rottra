import { createLogger } from "~/shared/logger";
const log = createLogger("agent-market");

export interface StockQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  timestamp: number;
}

const defaultStockPrices: Record<string, number> = {
  ACB: 27500,
  BCM: 61200,
  BID: 49500,
  BVH: 42300,
  CTG: 34100,
  FPT: 110500,
  GAS: 78900,
  GVR: 29800,
  HDB: 23400,
  HPG: 29500,
  MBB: 24100,
  MSN: 68400,
  MWG: 48900,
  PLX: 36700,
  POW: 11200,
  SAB: 56700,
  SHB: 11800,
  SSB: 22100,
  SSI: 35600,
  STB: 29400,
  TCB: 45600,
  TPB: 18900,
  VCB: 92400,
  VHM: 41200,
  VIB: 21500,
  VIC: 45600,
  VJC: 102500,
  VNM: 67800,
  VPB: 19500,
  VRE: 23400,
  BTC: 1650000000,
};

export const cachedStockQuotes: Record<string, StockQuote> = {};

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 800) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchStockQuote(symbol: string, allowLive = true): Promise<StockQuote | null> {
  const sym = symbol.toUpperCase();
  const now = Date.now();

  // 1. Check cache
  const cached = cachedStockQuotes[sym];
  const cacheTTL = 120000; // 2 minutes cache
  if (cached && cached.price && now - cached.timestamp < cacheTTL) {
    return cached;
  }

  // 2. Return simulated price update if live fetch is disabled or restricted
  if (!allowLive) {
    const basePrice = defaultStockPrices[sym] && defaultStockPrices[sym] > 0 ? defaultStockPrices[sym] : sym === "BTC" ? 0 : 50000;
    const lastPrice = cached?.price || basePrice;

    const simulated = {
      symbol: sym,
      price: lastPrice,
      change: 0,
      percentChange: 0,
      high: lastPrice,
      low: lastPrice,
      open: lastPrice,
      previousClose: lastPrice,
      timestamp: now,
    };
    cachedStockQuotes[sym] = simulated;
    return simulated;
  }

  let quote: StockQuote | null = null;

  try {
    if (sym === "BTC") {
      const cryptoQuote = await fetchCryptoQuote("BTC", true).catch(() => null);
      if (cryptoQuote && cryptoQuote.price) {
        quote = {
          symbol: "BTC",
          price: cryptoQuote.price,
          change: 0,
          percentChange: 0,
          high: null,
          low: null,
          open: null,
          previousClose: null,
          timestamp: cryptoQuote.timestamp,
        };
      }
    } else {
      quote = await fetchStockQuoteFallback(sym);
    }
  } catch (e) {
    log.warn(`[Stock Quote] Error fetching ${sym}:`, e);
  }

  if (!quote || !quote.price) {
    const defaultVal = defaultStockPrices[sym];
    const basePrice = defaultVal && defaultVal > 0 ? defaultVal : sym === "BTC" ? 0 : 50000;
    const lastPrice = cached?.price || basePrice;

    quote = {
      symbol: sym,
      price: lastPrice,
      change: 0,
      percentChange: 0,
      high: lastPrice,
      low: lastPrice,
      open: lastPrice,
      previousClose: lastPrice,
      timestamp: now,
    };
  } else {
    quote.timestamp = now; // Update timestamp
  }

  cachedStockQuotes[sym] = quote;
  return quote;
}
async function fetchStockQuoteFallback(symbol: string): Promise<StockQuote | null> {
  const sym = symbol.toUpperCase();
  const searchSymbol = symbol.includes(".VN") ? symbol : `${symbol}.VN`;
  const apiEndpoints = [
    `https://api.vietstock.vn/intraday/${searchSymbol}`,
    `https://quote.vietstock.vn/v2/web/stock/${searchSymbol}`,
    `https://finfo-api.vndirect.com.vn/rest/symbols/${searchSymbol.replace(".VN", "")}`,
  ];
  for (const url of apiEndpoints) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Rottra-Agent/1.0)" },
        },
        800,
      ).catch(() => null);
      if (response && response.ok) {
        const data = (await response.json()) as any;
        const price = data.price || data.lastPrice || data.close || data[0]?.price || null;
        const parsedPrice = price ? parseFloat(price) : null;
        const validPrice = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;
        if (validPrice) {
          return {
            symbol,
            price: validPrice,
            change: data.change || data[0]?.change || null,
            percentChange: data.percentChange || data[0]?.percentChange || null,
            high: data.high || data[0]?.high || null,
            low: data.low || data[0]?.low || null,
            open: data.open || data[0]?.open || null,
            previousClose: data.previousClose || data[0]?.previousClose || null,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
  }

  if (!sym.includes(".VN")) {
    try {
      const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${sym}&token=demo`;
      const res = await fetchWithTimeout(finnhubUrl, {}, 800);
      if (res && res.ok) {
        const data = (await res.json()) as any;
        if (data && data.c > 0) {
          return {
            symbol: sym,
            price: data.c,
            change: data.d || 0,
            percentChange: data.dp || 0,
            high: data.h || null,
            low: data.l || null,
            open: data.o || null,
            previousClose: data.pc || null,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
  }

  return null;
}

export async function fetchCryptoQuote(symbol: string, allowLive = true) {
  const sym = symbol.toUpperCase();
  const now = Date.now();

  const cached = cachedStockQuotes[sym];
  const cacheTTL = 120000; // 2 minutes
  if (cached && now - cached.timestamp < cacheTTL) {
    return cached;
  }

  const basePrice = 0;
  const cachedPrice = cached?.price || basePrice;

  if (!allowLive) {
    const simulated = {
      symbol: sym,
      price: cachedPrice,
      change: 0,
      percentChange: 0,
      high: null,
      low: null,
      open: null,
      previousClose: null,
      timestamp: now,
    };
    cachedStockQuotes[sym] = simulated;
    return simulated;
  }

  try {
    let cgId = sym.toLowerCase();
    if (cgId === "btc") cgId = "bitcoin";
    if (cgId === "eth") cgId = "ethereum";

    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=vnd`;
    const res = await fetchWithTimeout(cgUrl, {}, 2000);
    if (res && res.ok) {
      const data = (await res.json()) as any;
      const coinData = data[cgId];
      if (coinData && coinData.vnd) {
        return {
          symbol: sym,
          price: coinData.vnd,
          change: 0,
          percentChange: 0,
          high: coinData.vnd,
          low: coinData.vnd,
          open: coinData.vnd,
          previousClose: coinData.vnd,
          timestamp: Date.now(),
        };
      }
    }
  } catch (e) {
    log.error("Crypto fetch error:", e);
  }

  const finalQuote: StockQuote = {
    symbol: sym,
    price: cachedPrice,
    change: 0,
    percentChange: cachedStockQuotes[sym]?.percentChange || 0,
    high: cachedPrice,
    low: cachedPrice,
    open: cachedPrice,
    previousClose: cachedPrice,
    timestamp: Date.now(),
  };

  cachedStockQuotes[sym] = finalQuote;
  return finalQuote;
}
