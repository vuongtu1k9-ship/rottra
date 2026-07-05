import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    console.log("Fixing sensitive images in Product table...");
    
    // Set all products to use the default safe image
    const safeMedia = [{
      link: "/assets/Rottra-default-agri.png",
      name: "Default Product Image",
      type: "image"
    }];

    const result = await sql`
      UPDATE "Product"
      SET media = ${sql.json(safeMedia)}
      WHERE media IS NOT NULL
    `;
    
    console.log(`Successfully updated products with default safe image.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
