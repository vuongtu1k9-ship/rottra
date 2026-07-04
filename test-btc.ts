import { fetchStockQuote } from "./src/server/api/agent-router.ts";
async function run() {
  const quote = await fetchStockQuote("BTC");
  console.log(quote);
}
run();
