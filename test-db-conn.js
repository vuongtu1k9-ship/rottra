require("dotenv").config();
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 3, connect_timeout: 5 });

sql`SELECT 1`.then(r => {
  console.log("DB IS ALIVE:", r);
  process.exit(0);
}).catch(e => {
  console.error("DB ERROR:", e.message);
  process.exit(1);
});
