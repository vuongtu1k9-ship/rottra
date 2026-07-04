/**
 * 🧠 ROTTRA — FL TABLES MIGRATION
 * Creates federated learning tables in PostgreSQL.
 * Run with: bun scripts/db-ops/migrate-fl-tables.ts
 */

import { db } from "../../src/infra/database/db-pool";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting FL tables migration...\n");

  try {
    // FL Round
    console.log("  Creating fl_round table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fl_round" (
        "id" text PRIMARY KEY NOT NULL,
        "round_number" integer NOT NULL,
        "status" varchar(50) DEFAULT 'pending',
        "global_model_id" text,
        "config" jsonb,
        "started_at" timestamp with time zone,
        "completed_at" timestamp with time zone,
        "participant_count" integer DEFAULT 0,
        "aggregation_method" varchar(50) DEFAULT 'fedavg'
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_round_status" ON "fl_round" ("status")`);
    console.log("  ✅ fl_round created");

    // FL Gradient Update
    console.log("  Creating fl_gradient_update table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fl_gradient_update" (
        "id" text PRIMARY KEY NOT NULL,
        "round_id" text REFERENCES "fl_round"("id"),
        "node_id" text NOT NULL,
        "model_version" varchar(100),
        "gradient_hash" varchar(256),
        "data_sample_count" integer,
        "local_loss" real,
        "local_accuracy" real,
        "encrypted_gradients" jsonb,
        "submitted_at" timestamp with time zone DEFAULT NOW(),
        "status" varchar(50) DEFAULT 'pending'
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_gradient_round" ON "fl_gradient_update" ("round_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_gradient_node" ON "fl_gradient_update" ("node_id")`);
    console.log("  ✅ fl_gradient_update created");

    // FL Model Version
    console.log("  Creating fl_model_version table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fl_model_version" (
        "id" text PRIMARY KEY NOT NULL,
        "version_number" integer NOT NULL,
        "round_id" text REFERENCES "fl_round"("id"),
        "model_weights" jsonb,
        "model_hash" varchar(256),
        "parent_version_id" text,
        "metrics" jsonb,
        "created_at" timestamp with time zone DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_model_round" ON "fl_model_version" ("round_id")`);
    console.log("  ✅ fl_model_version created");

    // FL Node
    console.log("  Creating fl_node table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fl_node" (
        "id" text PRIMARY KEY NOT NULL,
        "node_name" varchar(255),
        "farm_id" text,
        "public_key" text,
        "last_seen" timestamp with time zone,
        "total_rounds_participated" integer DEFAULT 0,
        "reputation_score" real DEFAULT 1.0
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_node_farm" ON "fl_node" ("farm_id")`);
    console.log("  ✅ fl_node created");

    // FL Privacy Budget
    console.log("  Creating fl_privacy_budget table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fl_privacy_budget" (
        "id" text PRIMARY KEY NOT NULL,
        "node_id" text REFERENCES "fl_node"("id"),
        "epsilon_used" real DEFAULT 0,
        "epsilon_limit" real DEFAULT 10.0,
        "delta_used" real DEFAULT 0,
        "round_count" integer DEFAULT 0,
        "updated_at" timestamp with time zone DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fl_privacy_node" ON "fl_privacy_budget" ("node_id")`);
    console.log("  ✅ fl_privacy_budget created");

    console.log("\n✅ Migration complete! All FL tables created.\n");
  } catch (err: any) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
