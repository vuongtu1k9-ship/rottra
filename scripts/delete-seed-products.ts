import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    console.log("Deleting all seeded products (prod_seed_%)...");
    
    // Delete OrderItems first to satisfy foreign key constraint
    const orderItems = await sql`DELETE FROM "OrderItem" WHERE "productId" LIKE 'prod_seed_%' RETURNING id`;
    console.log(`Deleted ${orderItems.length} OrderItems referencing seeded products.`);
    
    // Delete them
    const result = await sql`DELETE FROM "Product" WHERE id LIKE 'prod_seed_%' RETURNING id`;
    
    console.log(`Successfully deleted ${result.length} system-seeded products.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
