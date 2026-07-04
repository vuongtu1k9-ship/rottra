import { db } from './src/infra/database/db-pool';
import { product } from './src/infra/database/schema';

async function run() {
  const p = await db.select().from(product).limit(3);
  console.log(JSON.stringify(p.map(x=>x.media), null, 2));
  process.exit(0);
}
run();
