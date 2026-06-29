const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, options: any = {}): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchStockQuote(symbol: string): Promise<any> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${upperSymbol}&token=demo`;
    const res = await fetchWithTimeout(finnhubUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.c > 0) {
        return {
          symbol: upperSymbol,
          price: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          prevClose: data.pc,
          source: "Finnhub",
        };
      }
    }
  } catch {}

  try {
    const ssiUrl = `https://finfo-api.ssi.com.vn/v4/stock_prices?date=eq.${new Date().toISOString().slice(0, 10)}&symbol=eq.${upperSymbol}`;
    const res = await fetchWithTimeout(ssiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.length > 0) {
        const d = data.data[0];
        return {
          symbol: upperSymbol,
          price: d.close,
          change: d.close - d.open,
          changePercent: ((d.close - d.open) / d.open) * 100,
          high: d.high,
          low: d.low,
          open: d.open,
          volume: d.volume,
          source: "SSI iBoard",
        };
      }
    }
  } catch {}

  return { symbol: upperSymbol, price: null, error: "Không tìm thấy mã chứng khoán", source: "N/A" };
}

export async function fetchCryptoQuote(symbol: string): Promise<any> {
  const pair = symbol.toUpperCase() + "USDT";

  try {
    const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
    const res = await fetchWithTimeout(binanceUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(data.lastPrice),
        change: parseFloat(data.priceChange),
        changePercent: parseFloat(data.priceChangePercent),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        source: "Binance",
      };
    }
  } catch {}

  try {
    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetchWithTimeout(cgUrl);
    if (res.ok) {
      const data = await res.json();
      const coinData = data[symbol.toLowerCase()];
      if (coinData) {
        return {
          symbol: symbol.toUpperCase(),
          price: coinData.usd,
          changePercent: coinData.usd_24h_change,
          source: "CoinGecko",
        };
      }
    }
  } catch {}

  return { symbol: symbol.toUpperCase(), price: null, error: "Không tìm thấy cryptocurrency", source: "N/A" };
}
