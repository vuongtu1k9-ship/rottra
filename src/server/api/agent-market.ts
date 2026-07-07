// ============================================================================
// STOCK & CRYPTO MARKET DATA (extracted from agent-router.ts)
// ============================================================================

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
  ACB: 0,
  BCM: 0,
  BID: 0,
  BVH: 0,
  CTG: 0,
  FPT: 0,
  GAS: 0,
  GVR: 0,
  HDB: 0,
  HPG: 0,
  MBB: 0,
  MSN: 0,
  MWG: 0,
  PLX: 0,
  POW: 0,
  SAB: 0,
  SHB: 0,
  SSB: 0,
  SSI: 0,
  STB: 0,
  TCB: 0,
  TPB: 0,
  VCB: 0,
  VHM: 0,
  VIB: 0,
  VIC: 0,
  VJC: 0,
  VNM: 0,
  VPB: 0,
  VRE: 0,
  BTC: 0,
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
  if (cached && cached.price && (now - cached.timestamp < cacheTTL)) {
    return cached;
  }

  // 2. Return simulated price update if live fetch is disabled or restricted
  if (!allowLive) {
    const basePrice = defaultStockPrices[sym] || 50000;
    const lastPrice = cached?.price || basePrice;
    const pctChange = (Math.random() - 0.5) * 0.02;
    const change = Math.round(lastPrice * pctChange);
    const newPrice = Math.max(100, lastPrice + change);

    const simulated = {
      symbol: sym,
      price: newPrice,
      change,
      percentChange: pctChange * 100,
      high: Math.round(newPrice * 1.02),
      low: Math.round(newPrice * 0.98),
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
    console.warn(`[Stock Quote] Error fetching ${sym}:`, e);
  }

  if (!quote || !quote.price) {
    const basePrice = defaultStockPrices[sym] || 50000;
    const lastPrice = cached?.price || basePrice;
    const pctChange = (Math.random() - 0.5) * 0.02;
    const change = Math.round(lastPrice * pctChange);
    const newPrice = Math.max(100, lastPrice + change);

    quote = {
      symbol: sym,
      price: newPrice,
      change,
      percentChange: pctChange * 100,
      high: Math.round(newPrice * 1.02),
      low: Math.round(newPrice * 0.98),
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
  const sym = symbol.toUpperCase().replace(".VN", "");

  try {
    const ssiUrl = `https://iboard-query.ssi.com.vn/stock/${sym}`;
    const response = await fetchWithTimeout(
      ssiUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://iboard.ssi.com.vn/",
          Origin: "https://iboard.ssi.com.vn",
          Accept: "application/json, text/plain, */*",
        },
      },
      600,
    ).catch(() => null);

    if (response && response.ok) {
      const result = (await response.json()) as any;
      if (result && result.code === "SUCCESS" && result.data) {
        const data = result.data;
        const price = data.matchedPrice || data.expectedMatchedPrice || data.refPrice || null;
        const parsedPrice = price ? parseFloat(price) : null;
        const validPrice = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;

        if (validPrice) {
          return {
            symbol: sym,
            price: validPrice,
            change: data.priceChange || data.expectedPriceChange || 0,
            percentChange: data.priceChangePercent || data.expectedPriceChangePercent || 0,
            high: data.highest || null,
            low: data.lowest || null,
            open: data.openPrice || null,
            previousClose: data.priorClosePrice || data.refPrice || null,
            timestamp: Date.now(),
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[SSI API Error] Failed for ${sym}:`, err);
  }

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
        400,
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
  if (cached && (now - cached.timestamp < cacheTTL)) {
    return cached;
  }

  if (!allowLive) {
    const basePrice = defaultStockPrices[sym] || 25400;
    const cachedPrice = cached?.price || basePrice;
    const pctChange = (Math.random() - 0.5) * 0.02;
    const newPrice = Math.max(1, Math.round(cachedPrice * (1 + pctChange)));
    const simulated = {
      symbol: sym,
      price: newPrice,
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
    if (sym === "BTC") {
      const coingeckoRes = await fetchWithTimeout(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=vnd",
        {},
        800,
      ).catch(() => null);
      if (coingeckoRes && coingeckoRes.ok) {
        const data = (await coingeckoRes.json()) as any;
        const priceVnd = data.bitcoin?.vnd;
        if (Number.isFinite(priceVnd) && priceVnd > 0) {
          return {
            symbol: "BTC",
            price: priceVnd,
            timestamp: Date.now(),
          };
        }
      }
    }
    const pair = sym.endsWith("USDT") ? sym : `${sym}USDT`;
    const res = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {}, 800).catch(() => null);
    if (res && res.ok) {
      const data = (await res.json()) as any;
      const priceVal = parseFloat(data.price);
      if (Number.isFinite(priceVal) && priceVal > 0) {
        const finalPrice = sym === "BTC" ? priceVal * 25400 : priceVal;
        return {
          symbol: sym,
          price: finalPrice,
          timestamp: Date.now(),
        };
      }
    }
  } catch (e) {
    console.error("Crypto fetch error:", e);
  }

  try {
    const cgId = sym.toLowerCase();
    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetchWithTimeout(cgUrl, {}, 800);
    if (res && res.ok) {
      const data = (await res.json()) as any;
      const coinData = data[cgId];
      if (coinData && coinData.usd) {
        return {
          symbol: sym,
          price: coinData.usd * 25400,
          changePercent: coinData.usd_24h_change || 0,
          timestamp: Date.now(),
        };
      }
    }
  } catch {}

  const basePrice = defaultStockPrices[sym] || 25400;
  const cachedPrice = cachedStockQuotes[sym]?.price || basePrice;
  const pctChange = (Math.random() - 0.5) * 0.02;
  const newPrice = Math.max(1, Math.round(cachedPrice * (1 + pctChange)));

  return {
    symbol: sym,
    price: newPrice,
    timestamp: Date.now(),
  };
}
