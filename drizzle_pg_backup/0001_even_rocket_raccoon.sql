CREATE TABLE "AiDrawingPath" (
	"productName" text PRIMARY KEY NOT NULL,
	"points" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "LogRollup" (
	"id" text PRIMARY KEY NOT NULL,
	"rollup_hour" timestamp with time zone NOT NULL,
	"total_logs" integer NOT NULL,
	"avg_entropy" real NOT NULL,
	"avg_word_count" real NOT NULL,
	"avg_char_count" real NOT NULL,
	"intent_distribution" jsonb NOT NULL,
	"word_frequencies" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "LogRollup_rollup_hour_unique" UNIQUE("rollup_hour")
);
--> statement-breakpoint
CREATE TABLE "VectorDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"category" varchar(150) NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding" halfvec(256),
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "BilingualCorpus" ALTER COLUMN "en" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSetting" ALTER COLUMN "autoBot" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "BilingualCorpus" ADD COLUMN "zh" text;--> statement-breakpoint
ALTER TABLE "BilingualCorpus" ADD COLUMN "ja" text;--> statement-breakpoint
ALTER TABLE "BilingualCorpus" ADD COLUMN "fi" text;--> statement-breakpoint
ALTER TABLE "BilingualCorpus" ADD COLUMN "he" text;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "target_price" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "cost_price" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "velocity" real DEFAULT 1;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "kalman_variance" real DEFAULT 0.1;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "storage_cost" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "SystemSetting" ADD COLUMN "wifiPerf" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "vector_document_idx" ON "VectorDocument" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_memory_session_id" ON "AgentMemory" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_context_key" ON "AgentMemory" USING btree ("contextKey");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_session_context" ON "AgentMemory" USING btree ("sessionId","contextKey");--> statement-breakpoint
CREATE INDEX "idx_message_assembly_id" ON "Message" USING btree ("assemblyId");--> statement-breakpoint
CREATE INDEX "idx_product_seller_id" ON "Product" USING btree ("sellerId");