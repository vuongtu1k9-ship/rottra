import { db } from "./src/server/db/schema";
import { GenerateVideoAction, GenerateImageAction } from "./src/core/cognitive-swarm/bot-actions";
import { product } from "./src/server/db/schema";

async function run() {
  const videoAction = new GenerateVideoAction();
  const imageAction = new GenerateImageAction();
  
  // Fake helpers
  const helpers = {
    logActivity: async (a: any, b: any, c: any, d: any) => { console.log("Log:", a, b, c, d); },
    getProductImageUrl: (media: any[]) => { return media && media[0] ? media[0].link : ""; }
  };
  
  // Lấy 1 userId có sản phẩm
  const allProds = await db.query.product.findMany({ limit: 1 });
  if (allProds.length === 0) {
    console.log("No products");
    return;
  }
  const sellerId = allProds[0].sellerId;
  
  console.log("Testing GenerateImageAction...");
  try {
    const imgResult = await imageAction.execute(sellerId, "agent-123", helpers as any);
    console.log("Image Result:", imgResult);
  } catch (e) {
    console.error("Image Error:", e);
  }

  console.log("Testing GenerateVideoAction...");
  try {
    const vidResult = await videoAction.execute(sellerId, "agent-123", helpers as any);
    console.log("Video Result:", vidResult);
  } catch (e) {
    console.error("Video Error:", e);
  }
  
  process.exit(0);
}

run();
