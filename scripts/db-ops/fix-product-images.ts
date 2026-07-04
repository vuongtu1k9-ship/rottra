import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    const products = await sql`SELECT id, name, description FROM "Product"`;
    console.log(`Found ${products.length} products. Updating images...`);

    let updatedCount = 0;
    for (const p of products) {
      const text = (p.name + " " + (p.description || "")).toLowerCase();
      
      let imageUrl = "/vegetable.jpg";
      if (text.includes("cà phê") || text.includes("coffee") || text.includes("robusta")) {
        imageUrl = "/coffee.jpg";
      } else if (text.includes("trà") || text.includes("chè") || text.includes("shan tuyết")) {
        imageUrl = "/tea.jpg";
      } else if (text.includes("sầu riêng") || text.includes("durian")) {
        imageUrl = "/durian.jpg";
      } else if (text.includes("xoài") || text.includes("mango")) {
        imageUrl = "/mango.jpg";
      } else if (text.includes("gạo") || text.includes("lúa") || text.includes("st25")) {
        imageUrl = "/rice.jpg";
      }

      const mediaArr = [{ link: imageUrl, type: "image", name: "Product Image" }];
      
      await sql`UPDATE "Product" SET media = ${sql.json(mediaArr)} WHERE id = ${p.id}`;
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} product images.`);
  } catch (err) {
    console.error("Error updating images:", err);
  } finally {
    await sql.end();
  }
}

main();
