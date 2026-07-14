import { db } from "~/infra/database/db-pool";
import { product, vectorDocument } from "~/infra/database/schema";
import { generateEmbedding, cosineSimilarity } from "./embedding-service";
import { createLogger } from "~/shared/logger";

const log = createLogger("rag-retriever");

export async function retrieveRelevantProducts(query: string, limit: number = 3) {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding.length) return [];

  // Fetch all products with embeddings (in a real prod app with pgvector, we would use SQL <=> operator)
  const allProducts = await db.query.product.findMany();

  const scoredProducts = allProducts
    .map((p: any) => {
      let score = 0;
      if (p.embedding && Array.isArray(p.embedding)) {
        score = cosineSimilarity(queryEmbedding, p.embedding as number[]);
      }
      return { product: p, score };
    })
    .filter((p: any) => p.score > 0.3) // Threshold
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);

  return scoredProducts.map((p: any) => p.product);
}

export async function retrieveMarketNews(query: string, limit: number = 2) {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding.length) return [];

  const allNews = await db.query.vectorDocument.findMany();

  const scoredNews = allNews
    .map((doc: any) => {
      let score = 0;
      if (doc.embedding && Array.isArray(doc.embedding)) {
        score = cosineSimilarity(queryEmbedding, doc.embedding as number[]);
      }
      return { doc, score };
    })
    .filter((doc: any) => doc.score > 0.3) // Threshold
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);

  return scoredNews.map((n: any) => n.doc);
}
