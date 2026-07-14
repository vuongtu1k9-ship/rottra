import { db } from "~/infra/database/db-pool";
import { product, user } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { serverAgentBudgets } from "~/shared/constants";

export interface AIContext {
  budget: number;
  inventorySize: number;
  avgPrice: number;
  marketAvgPrice: number;
  outOfStockCount: number;
  missingImagesCount: number;
}

// Normalization function to map value to [0.0, 1.0]
export function normalize(value: number, min: number, max: number): number {
  if (max - min === 0) return 0.0;
  const val = (value - min) / (max - min);
  return Math.min(Math.max(val, 0.0), 1.0);
}

// Response curve functions mapping x [0.0, 1.0] to y [0.0, 1.0]
export type CurveFunction = (x: number) => number;

export const Curves = {
  Linear: (x: number) => x,
  Quadratic: (x: number) => x * x,
  InverseQuadratic: (x: number) => 1.0 - x * x,
  Sigmoid: (x: number) => 1.0 / (1.0 + Math.exp(-10.0 * (x - 0.5))),
  InverseLinear: (x: number) => 1.0 - x,
};

export class Consideration {
  constructor(
    public name: string,
    private scoreFunc: (ctx: AIContext) => number,
    private curve: CurveFunction = Curves.Linear,
  ) {}

  evaluate(ctx: AIContext): number {
    const rawScore = this.scoreFunc(ctx);
    return this.curve(rawScore);
  }
}

export class UtilityAction {
  private considerations: Consideration[] = [];

  constructor(public name: string) {}

  addConsideration(c: Consideration) {
    this.considerations.push(c);
  }

  evaluate(ctx: AIContext): number {
    if (this.considerations.length === 0) return 0.0;

    let finalScore = 1.0;
    for (const c of this.considerations) {
      const score = c.evaluate(ctx);
      if (score === 0.0) {
        return 0.0; // Veto
      }
      finalScore *= score;
    }

    // Makeup calculation as implemented in Lackey C++:
    const modificationFactor = 1.0 - 1.0 / this.considerations.length;
    const makeupValue = (1.0 - finalScore) * modificationFactor;
    return finalScore + makeupValue * finalScore;
  }
}

export class UtilityAI {
  private actions: UtilityAction[] = [];

  registerAction(action: UtilityAction) {
    this.actions.push(action);
  }

  getBestAction(ctx: AIContext): { name: string; score: number } {
    let bestScore = -1.0;
    let bestActionName = "add"; // Default fallback

    for (const action of this.actions) {
      const score = action.evaluate(ctx);
      if (score > bestScore) {
        bestScore = score;
        bestActionName = action.name;
      }
    }

    return { name: bestActionName, score: bestScore };
  }

  getAllScores(ctx: AIContext): Array<{ name: string; score: number }> {
    return this.actions.map((action) => ({
      name: action.name,
      score: action.evaluate(ctx),
    }));
  }
}

// Dynamic database helper to build the AIContext for a user/agent
export async function getAgentContext(userId: string): Promise<AIContext> {
  const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });

  let budget = 0;
  if (dbUser) {
    const profile = (dbUser.profile as any) || {};
    budget = profile.budget ?? serverAgentBudgets[userId] ?? 0;
  }

  // Get agent's products
  const agentProducts = await db.query.product.findMany({
    where: eq(product.sellerId, userId),
  });

  const inventorySize = agentProducts.length;
  let totalProductPrice = 0;
  let outOfStockCount = 0;
  let missingImagesCount = 0;

  for (const prod of agentProducts) {
    totalProductPrice += prod.price ?? 0;
    if (prod.quantity === 0) {
      outOfStockCount++;
    }

    // Check if media contains a placeholder or is missing
    const media = prod.media as any[];
    const hasImage =
      media &&
      Array.isArray(media) &&
      media.length > 0 &&
      media.some((m) => m.link && !m.link.includes("no-image") && !m.link.includes("dummy"));
    if (!hasImage) {
      missingImagesCount++;
    }
  }

  const avgPrice = inventorySize > 0 ? totalProductPrice / inventorySize : 0;

  // Get market average price
  const allProducts = await db.query.product.findMany();
  let totalMarketPrice = 0;
  for (const prod of allProducts) {
    totalMarketPrice += prod.price ?? 0;
  }
  const marketAvgPrice = allProducts.length > 0 ? totalMarketPrice / allProducts.length : 1;

  return {
    budget,
    inventorySize,
    avgPrice,
    marketAvgPrice,
    outOfStockCount,
    missingImagesCount,
  };
}

// Build standard Agent Utility Evaluator
export function createAgentBrainEvaluator(): UtilityAI {
  const ai = new UtilityAI();

  // 1. ADD ACTION
  // Wants to add when inventory is small, or budget is low (needs rewards), or no products exist
  const addAction = new UtilityAction("add");
  addAction.addConsideration(new Consideration("Low Inventory", (ctx) => 1.0 - normalize(ctx.inventorySize, 0, 15), Curves.Linear));
  addAction.addConsideration(new Consideration("Low Budget Need", (ctx) => 1.0 - normalize(ctx.budget, 0, 500_000_000), Curves.Quadratic));
  ai.registerAction(addAction);

  // 2. EDIT ACTION
  // Wants to edit (price drop/info) when prices are too high compared to market, or inventory is high
  const editAction = new UtilityAction("edit");
  editAction.addConsideration(
    new Consideration(
      "Overpriced items",
      (ctx) => {
        if (ctx.avgPrice === 0) return 0.0;
        const ratio = ctx.avgPrice / ctx.marketAvgPrice;
        return normalize(ratio, 0.8, 1.8);
      },
      Curves.Sigmoid,
    ),
  );
  editAction.addConsideration(new Consideration("High Inventory Stockpile", (ctx) => normalize(ctx.inventorySize, 0, 15), Curves.Linear));
  ai.registerAction(editAction);

  // 3. DELETE ACTION
  // Wants to delete when has out-of-stock items
  const deleteAction = new UtilityAction("delete");
  deleteAction.addConsideration(new Consideration("Has Out of Stock", (ctx) => (ctx.outOfStockCount > 0 ? 1.0 : 0.0)));
  ai.registerAction(deleteAction);

  // 4. IMAGE ACTION
  // Wants to generate images when products are missing images
  const imageAction = new UtilityAction("image");
  imageAction.addConsideration(new Consideration("Has Missing Images", (ctx) => (ctx.missingImagesCount > 0 ? 1.0 : 0.0)));
  imageAction.addConsideration(
    new Consideration("Affordable Budget", (ctx) => normalize(ctx.budget, 10_000_000, 100_000_000), Curves.Linear),
  );
  ai.registerAction(imageAction);

  // 5. 3D ACTION
  // Wants to render 3D-style images when has missing images or high budget
  const threeDAction = new UtilityAction("3d");
  threeDAction.addConsideration(
    new Consideration("Has Missing Images or Wants Premium 3D", (ctx) => {
      if (ctx.missingImagesCount > 0) return 1.0;
      return ctx.inventorySize > 0 ? 0.4 : 0.0;
    }),
  );
  threeDAction.addConsideration(
    new Consideration("Premium Budget", (ctx) => normalize(ctx.budget, 50_000_000, 300_000_000), Curves.Sigmoid),
  );
  ai.registerAction(threeDAction);

  // 6. VIDEO ACTION
  // Wants to generate video ad when budget is extremely high (luxurious marketing)
  const videoAction = new UtilityAction("video");
  videoAction.addConsideration(new Consideration("Has inventory to promote", (ctx) => (ctx.inventorySize > 0 ? 1.0 : 0.0)));
  videoAction.addConsideration(
    new Consideration("Huge Budget", (ctx) => normalize(ctx.budget, 200_000_000, 1_000_000_000), Curves.Quadratic),
  );
  ai.registerAction(videoAction);

  return ai;
}
