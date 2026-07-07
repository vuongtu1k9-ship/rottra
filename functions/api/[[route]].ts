import app from "../../src/routes/api/[...paths]";
import { dbContext } from "../../src/infra/database/als";

export const onRequest: PagesFunction<{ ROTTRA_D1: any }> = async (context) => {
  // Inject the D1 database binding into the async context
  return dbContext.run(context.env.ROTTRA_D1, async () => {
    // Let Hono handle the request natively
    return app.fetch(context.request, context.env, context);
  });
};
