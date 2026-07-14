/**
 * AI Modules — Database Schema Additions
 * Tables for: ML Pipeline, Self-Evolving Agent, ML Chat, Turing Test, AI Education
 */

import { pgTable, text, integer, real, varchar, timestamp, jsonb, boolean, serial } from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════
// Module 1: ML Training Pipeline
// ═══════════════════════════════════════════════════════════

export const mlModel = pgTable("ml_model", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  algorithm: varchar("algorithm", { length: 64 }).notNull(),
  weightsJson: jsonb("weights_json").notNull(),
  hyperparamsJson: jsonb("hyperparams_json").notNull(),
  metricsJson: jsonb("metrics_json"),
  featureConfigJson: jsonb("feature_config_json"),
  trainingSamples: integer("training_samples").default(0),
  intent: varchar("intent", { length: 64 }),
  status: varchar("status", { length: 16 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const mlTrainingRun = pgTable("ml_training_run", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").references(() => mlModel.id),
  configJson: jsonb("config_json").notNull(),
  resultJson: jsonb("result_json"),
  status: varchar("status", { length: 16 }).default("running"),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ═══════════════════════════════════════════════════════════
// Module 2: Self-Evolving AI Agent
// ═══════════════════════════════════════════════════════════

export const evolutionSession = pgTable("evolution_session", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  strategy: varchar("strategy", { length: 32 }).notNull(),
  generationsRun: integer("generations_run").default(0),
  bestFitness: real("best_fitness").default(0),
  bestDnaJson: jsonb("best_dna_json"),
  populationJson: jsonb("population_json"),
  convergenceHistory: jsonb("convergence_history"),
  status: varchar("status", { length: 16 }).default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const abTest = pgTable("ab_test", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  configJson: jsonb("config_json").notNull(),
  variantAMetricsJson: jsonb("variant_a_metrics_json"),
  variantBMetricsJson: jsonb("variant_b_metrics_json"),
  pValue: real("p_value"),
  significant: boolean("significant"),
  winner: varchar("winner", { length: 8 }),
  status: varchar("status", { length: 16 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const curriculumPlan = pgTable("curriculum_plan", {
  id: serial("id").primaryKey(),
  topicsJson: jsonb("topics_json").notNull(),
  estimatedImprovement: real("estimated_improvement"),
  status: varchar("status", { length: 16 }).default("active"),
  currentTopicIndex: integer("current_topic_index").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════
// Module 3: ML Chat Enhancement
// ═══════════════════════════════════════════════════════════

export const mlChatConfig = pgTable("ml_chat_config", {
  id: serial("id").primaryKey(),
  intentModelId: integer("intent_model_id").references(() => mlModel.id),
  sentimentModelId: integer("sentiment_model_id").references(() => mlModel.id),
  rerankerModelId: integer("reranker_model_id").references(() => mlModel.id),
  mlConfidenceThreshold: real("ml_confidence_threshold").default(0.4),
  rerankingEnabled: boolean("reranking_enabled").default(true),
  status: varchar("status", { length: 16 }).default("active"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════
// Module 4: Turing Test
// ═══════════════════════════════════════════════════════════

export const turingTestSession = pgTable("turing_test_session", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 16 }).notNull(),
  roundNumber: integer("round_number").default(0),
  maxRounds: integer("max_rounds").default(5),
  configJson: jsonb("config_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const turingTestParticipant = pgTable("turing_test_participant", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).references(() => turingTestSession.id),
  userId: varchar("user_id", { length: 64 }),
  role: varchar("role", { length: 8 }).notNull(),
  displayName: varchar("display_name", { length: 128 }),
  score: integer("score").default(0),
});

export const turingTestRound = pgTable("turing_test_round", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).references(() => turingTestSession.id),
  roundNumber: integer("round_number").notNull(),
  messagesJson: jsonb("messages_json"),
  verdictJson: jsonb("verdict_json"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const turingTestLeaderboard = pgTable("turing_test_leaderboard", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  displayName: varchar("display_name", { length: 128 }),
  totalScore: integer("total_score").default(0),
  gamesPlayed: integer("games_played").default(0),
  roundsWon: integer("rounds_won").default(0),
  winStreak: integer("win_streak").default(0),
  bestStreak: integer("best_streak").default(0),
  role: varchar("role", { length: 8 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════
// Module 5: AI Education
// ═══════════════════════════════════════════════════════════

export const eduProgress = pgTable("edu_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  module: varchar("module", { length: 32 }).notNull(),
  completed: boolean("completed").default(false),
  quizScore: integer("quiz_score"),
  xpEarned: integer("xp_earned").default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const eduQuizAttempt = pgTable("edu_quiz_attempt", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  questionId: varchar("question_id", { length: 64 }).notNull(),
  selectedIndex: integer("selected_index"),
  correct: boolean("correct"),
  timeSpentMs: integer("time_spent_ms"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow(),
});

// ── Type Exports ─────────────────────────────────────────

export type MLModel = typeof mlModel.$inferSelect;
export type MLModelInsert = typeof mlModel.$inferInsert;
export type MLTrainingRun = typeof mlTrainingRun.$inferSelect;
export type EvolutionSession = typeof evolutionSession.$inferSelect;
export type ABTest = typeof abTest.$inferSelect;
export type TuringTestSessionRow = typeof turingTestSession.$inferSelect;
export type EduProgress = typeof eduProgress.$inferSelect;
