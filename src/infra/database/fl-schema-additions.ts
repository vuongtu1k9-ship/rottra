/**
 * 🧠 ROTTRA — FEDERATED LEARNING SCHEMA ADDITIONS
 * Database tables for FL system.
 * Uses Drizzle ORM.
 */

import { pgTable, text, integer, real, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── FL Round ─────────────────────────────────────────────────

export const flRound = pgTable("fl_round", {
  id: text("id").primaryKey(),
  roundNumber: integer("round_number").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  globalModelId: text("global_model_id"),
  config: jsonb("config"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  participantCount: integer("participant_count").default(0),
  aggregationMethod: varchar("aggregation_method", { length: 50 }).default("fedavg"),
});

// ── Gradient Updates ─────────────────────────────────────────

export const flGradientUpdate = pgTable("fl_gradient_update", {
  id: text("id").primaryKey(),
  roundId: text("round_id").references(() => flRound.id),
  nodeId: text("node_id").notNull(),
  modelVersion: varchar("model_version", { length: 100 }),
  gradientHash: varchar("gradient_hash", { length: 256 }),
  dataSampleCount: integer("data_sample_count"),
  localLoss: real("local_loss"),
  localAccuracy: real("local_accuracy"),
  encryptedGradients: jsonb("encrypted_gradients"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 50 }).default("pending"),
});

// ── Model Versions ───────────────────────────────────────────

export const flModelVersion = pgTable("fl_model_version", {
  id: text("id").primaryKey(),
  versionNumber: integer("version_number").notNull(),
  roundId: text("round_id").references(() => flRound.id),
  modelWeights: jsonb("model_weights"),
  modelHash: varchar("model_hash", { length: 256 }),
  parentVersionId: text("parent_version_id"),
  metrics: jsonb("metrics"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Node Registry ────────────────────────────────────────────

export const flNode = pgTable("fl_node", {
  id: text("id").primaryKey(),
  nodeName: varchar("node_name", { length: 255 }),
  farmId: text("farm_id"),
  publicKey: text("public_key"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  totalRoundsParticipated: integer("total_rounds_participated").default(0),
  reputationScore: real("reputation_score").default(1.0),
});

// ── Privacy Budget ───────────────────────────────────────────

export const flPrivacyBudget = pgTable("fl_privacy_budget", {
  id: text("id").primaryKey(),
  nodeId: text("node_id").references(() => flNode.id),
  epsilonUsed: real("epsilon_used").default(0),
  epsilonLimit: real("epsilon_limit").default(10.0),
  deltaUsed: real("delta_used").default(0),
  roundCount: integer("round_count").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Type exports ─────────────────────────────────────────────

export type FLRound = typeof flRound.$inferSelect;
export type FLRoundInsert = typeof flRound.$inferInsert;

export type FLGradientUpdate = typeof flGradientUpdate.$inferSelect;
export type FLGradientUpdateInsert = typeof flGradientUpdate.$inferInsert;

export type FLModelVersion = typeof flModelVersion.$inferSelect;
export type FLModelVersionInsert = typeof flModelVersion.$inferInsert;

export type FLNode = typeof flNode.$inferSelect;
export type FLNodeInsert = typeof flNode.$inferInsert;

export type FLPrivacyBudget = typeof flPrivacyBudget.$inferSelect;
export type FLPrivacyBudgetInsert = typeof flPrivacyBudget.$inferInsert;
