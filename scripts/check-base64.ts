import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const agents = await sql`SELECT id, name, image FROM "user" WHERE image LIKE 'data:image%'`;
    console.log("Users with base64 images:", agents.length);
    if (agents.length > 0) {
       console.log(agents.map(a => ({ id: a.id, name: a.name, imageLength: a.image?.length })));
    }
    
    // Check product media
    const products = await sql`SELECT id, media FROM "Product"`;
    let base64Products = 0;
    for (const p of products) {
        if (p.media && Array.isArray(p.media)) {
             for (const m of p.media) {
                 if (typeof m === 'string' && m.startsWith('data:image')) {
                     base64Products++;
                     break;
                 }
             }
        }
    }
    console.log("Products with base64 images:", base64Products);
    
    // Check file table
    const files = await sql`SELECT id, path FROM "File" WHERE path LIKE 'data:image%'`;
    console.log("Files with base64 URLs:", files.length);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
