import { fetchGoldPrice } from "../src/server/api/agent-router";

async function main() {
  try {
    const gold = await fetchGoldPrice();
    console.log("Gold price:", gold);
  } catch (err: any) {
    console.error("Error fetching gold price:", err.message);
  }
  process.exit(0);
}

main();
