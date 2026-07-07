import app from "../../src/routes/api/[...paths]";
import { dbContext } from "../../src/infra/database/als";

export const onRequest: PagesFunction<{ ROTTRA_D1: any }> = async (context) => {
  console.log(`[CF PAGES] Incoming Request URL: ${context.request.url}`);
  // Inject the D1 database binding into the async context
  return dbContext.run(context.env.ROTTRA_D1, async () => {
    // Let Hono handle the request natively
    const response = await app.fetch(context.request, context.env, context);
    console.log(`[CF PAGES] Hono Response Status: ${response.status}`);
    return response;
  });
};
