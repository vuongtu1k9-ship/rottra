import { fetchCryptoQuote } from "./src/server/api/agent-router.ts";
async function run() {
  const quote = await fetchCryptoQuote("BTC");
  console.log(quote);
}
run();
