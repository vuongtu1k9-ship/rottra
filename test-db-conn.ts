import postgres from "postgres";

async function run() {
  try {
    const sql = postgres(process.env.DATABASE_URL || "postgresql://postgres.lzleicitednshoqdqfqp:8tZn6MCqyqQMNhYH@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require", { 
      max: 2, 
      idle_timeout: 3, 
      connect_timeout: 10 
    });
    
    console.log("Connecting...");
    const result = await sql`SELECT 1`;
    console.log("DB IS ALIVE:", result);
    process.exit(0);
  } catch (e) {
    console.error("DB ERROR:", e);
    process.exit(1);
  }
}

run();
