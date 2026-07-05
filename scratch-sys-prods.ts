import { db } from "./src/infra/database/db-pool";
import { product } from "./src/infra/database/schema";
import { inArray } from "drizzle-orm";

async function dumpSysProds() {
  const sysProds = await db.query.product.findMany({
    where: inArray(product.sellerId, ["admin", "root", "system"]),
  });
  console.log(JSON.stringify(sysProds.map(p => ({id: p.id, name: p.name, media: p.media})), null, 2));
  process.exit(0);
}
dumpSysProds();
