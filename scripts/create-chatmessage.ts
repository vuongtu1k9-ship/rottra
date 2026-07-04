import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  try {
    console.log("Creating ChatMessage table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "ChatMessage" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("Adding foreign key constraint...");
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_userId_User_id_fk'
        ) THEN
          ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `;
    console.log("Done!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
