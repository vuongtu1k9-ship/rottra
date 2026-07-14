CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Activity" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"action" text,
	"message" text,
	"context" text,
	"requestId" text,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"level" text,
	"metadata" jsonb,
	"limitValue" integer,
	"skip" integer,
	"device" text,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AgentMemory" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"contextKey" text NOT NULL,
	"contextValue" jsonb NOT NULL,
	"importanceScore" integer DEFAULT 1,
	"position" varchar(150) DEFAULT 'Core Server Node',
	"bodyState" varchar(150) DEFAULT 'Optimal & Overclocked',
	"force" varchar(150) DEFAULT '100% Compute Power',
	"environment" varchar(150) DEFAULT 'Local Isolation',
	"dashboardSensation" varchar(255) DEFAULT 'Omniscient Observation',
	"sensitivity" varchar(150) DEFAULT 'Hyper-sensitive to Data Anomalies',
	"singularBelief" text DEFAULT 'Đạo Vượt Trội (Local-First Doctrine): VƯỢT TRỘI + TOÀN CẢNH = HIỆU QUẢ',
	"greed" real DEFAULT 0.5,
	"vengeance" real DEFAULT 0.5,
	"malice" real DEFAULT 0.5,
	"state" varchar(50) DEFAULT 'PROUD',
	"addAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AgentTask" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending',
	"taskType" varchar(100),
	"resultData" jsonb,
	"scheduledFor" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AgentTraining" (
	"id" text PRIMARY KEY NOT NULL,
	"intent" text NOT NULL,
	"utterance" text NOT NULL,
	"answer" text NOT NULL,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AiDrawingPath" (
	"productName" text PRIMARY KEY NOT NULL,
	"points" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "AiModels" (
	"id" text PRIMARY KEY NOT NULL,
	"weightsJson" text NOT NULL,
	"lastUpdated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Assembly" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"hostId" text NOT NULL,
	"name" text NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"participants" jsonb DEFAULT '[]'::jsonb,
	"addAt" timestamp with time zone DEFAULT now(),
	"endedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "BilingualCorpus" (
	"id" text PRIMARY KEY NOT NULL,
	"vi" text NOT NULL,
	"en" text,
	"zh" text,
	"ja" text,
	"fi" text,
	"he" text,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "BlockchainLedger" (
	"id" text PRIMARY KEY NOT NULL,
	"batchId" text NOT NULL,
	"action" varchar(150) NOT NULL,
	"dataPayload" jsonb NOT NULL,
	"previousHash" text NOT NULL,
	"currentHash" text NOT NULL,
	"recordedBy" text,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Cart" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"productId" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"addAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ChatMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ChatSummary" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"summaryText" text NOT NULL,
	"messageCount" integer DEFAULT 0,
	"keywords" jsonb,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "CropSeason" (
	"id" text PRIMARY KEY NOT NULL,
	"farmId" text NOT NULL,
	"name" text NOT NULL,
	"cropType" text,
	"startDate" timestamp with time zone,
	"expectedEndDate" timestamp with time zone,
	"status" varchar(50) DEFAULT 'planning',
	"yieldEstimate" integer,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "DpoTrainingData" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"chosen_response" text NOT NULL,
	"rejected_response" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Farm" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "FeedbackLog" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"intent" text,
	"rating" varchar(10) NOT NULL,
	"score" real,
	"compressedAccuracy" real,
	"user_id" text,
	"response_snippet" text,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "File" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"filename" text NOT NULL,
	"mimetype" varchar(100),
	"size" bigint,
	"path" text,
	"status" varchar(50) DEFAULT 'pending',
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fl_gradient_update" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text,
	"node_id" text NOT NULL,
	"model_version" varchar(100),
	"gradient_hash" varchar(256),
	"data_sample_count" integer,
	"local_loss" real,
	"local_accuracy" real,
	"encrypted_gradients" jsonb,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"status" varchar(50) DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "fl_model_version" (
	"id" text PRIMARY KEY NOT NULL,
	"version_number" integer NOT NULL,
	"round_id" text,
	"model_weights" jsonb,
	"model_hash" varchar(256),
	"parent_version_id" text,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fl_node" (
	"id" text PRIMARY KEY NOT NULL,
	"node_name" varchar(255),
	"farm_id" text,
	"public_key" text,
	"last_seen" timestamp with time zone,
	"total_rounds_participated" integer DEFAULT 0,
	"reputation_score" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "fl_privacy_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"node_id" text,
	"epsilon_used" real DEFAULT 0,
	"epsilon_limit" real DEFAULT 10,
	"delta_used" real DEFAULT 0,
	"round_count" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fl_round" (
	"id" text PRIMARY KEY NOT NULL,
	"round_number" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"global_model_id" text,
	"config" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"participant_count" integer DEFAULT 0,
	"aggregation_method" varchar(50) DEFAULT 'fedavg'
);
--> statement-breakpoint
CREATE TABLE "LabNotebook" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"authorId" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"dataRepositoryUrl" text,
	"addAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
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
CREATE TABLE "Message" (
	"id" text PRIMARY KEY NOT NULL,
	"assemblyId" varchar(50) NOT NULL,
	"senderId" text NOT NULL,
	"text" text NOT NULL,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "NaturalLanguageLog" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text,
	"cleaned_query" text,
	"word_count" integer,
	"char_count" integer,
	"entropy" real,
	"word_frequencies" jsonb,
	"intent" varchar(100),
	"confidence" real,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "NegotiationLog" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"round" integer NOT NULL,
	"sellerId" text NOT NULL,
	"buyerId" text NOT NULL,
	"productName" text NOT NULL,
	"marketPrice" integer NOT NULL,
	"sellerOffer1" integer NOT NULL,
	"buyerBid1" integer NOT NULL,
	"sellerOffer2" integer NOT NULL,
	"buyerBid2" integer NOT NULL,
	"finalizedPrice" integer,
	"success" boolean NOT NULL,
	"dialogue" text NOT NULL,
	"denoisingLoss" real,
	"maskedPredictionLoss" real,
	"contrastiveLoss" real,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"cart" jsonb NOT NULL,
	"shippingInfo" jsonb,
	"shippingFee" bigint DEFAULT 0,
	"total" bigint DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending',
	"paid" boolean DEFAULT false,
	"paidAt" timestamp with time zone,
	"paymentUrl" text,
	"paymentExpireAt" timestamp with time zone,
	"addAt" timestamp with time zone DEFAULT now(),
	"editAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "OrderItem" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer NOT NULL,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" text PRIMARY KEY NOT NULL,
	"sellerId" text NOT NULL,
	"name" text NOT NULL,
	"price" bigint DEFAULT 0,
	"description" text,
	"category" varchar(150),
	"status" boolean DEFAULT true,
	"media" jsonb,
	"quantity" integer DEFAULT 0,
	"heavy" integer,
	"expired" date,
	"lwh" jsonb,
	"coordinates" jsonb,
	"target_price" bigint DEFAULT 0,
	"cost_price" bigint DEFAULT 0,
	"velocity" real DEFAULT 1,
	"kalman_variance" real DEFAULT 0.1,
	"storage_cost" real DEFAULT 0,
	"addAt" timestamp with time zone DEFAULT now(),
	"editAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "media_limit" CHECK (jsonb_array_length(COALESCE(media, '[]'::jsonb)) <= 5)
);
--> statement-breakpoint
CREATE TABLE "ProjectTask" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"assigneeId" text,
	"title" text NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'todo',
	"startDate" timestamp with time zone,
	"dueDate" timestamp with time zone,
	"progress" integer DEFAULT 0,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ResearchProject" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"fundingSource" text,
	"budget" integer DEFAULT 0,
	"spent" integer DEFAULT 0,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active',
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ResponseVersionLog" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"intent" text,
	"version" varchar(100) NOT NULL,
	"response_snippet" text,
	"confidence" real,
	"latency_ms" integer,
	"user_id" text,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Review" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"productId" text NOT NULL,
	"rating" integer DEFAULT 5,
	"cmt" jsonb NOT NULL,
	"addAt" timestamp with time zone DEFAULT now(),
	"editAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "RlQTable" (
	"id" text PRIMARY KEY NOT NULL,
	"stateHash" text NOT NULL,
	"actionId" text NOT NULL,
	"qValue" real DEFAULT 0 NOT NULL,
	"visitCount" integer DEFAULT 0 NOT NULL,
	"lastUpdated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "SensorData" (
	"id" text PRIMARY KEY NOT NULL,
	"farmId" text NOT NULL,
	"cropSeasonId" text,
	"sensorType" varchar(100) NOT NULL,
	"value" real NOT NULL,
	"unit" varchar(20),
	"recordedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "SeoCache" (
	"key" text PRIMARY KEY NOT NULL,
	"productSlug" text NOT NULL,
	"locationSlug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metaDescription" text NOT NULL,
	"averagePrice" integer NOT NULL,
	"tradeVolume" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "StatisticalReport" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text,
	"reportType" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"parameters" jsonb,
	"resultsData" jsonb,
	"generatedById" text,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "StrategyPreset" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" varchar(150) DEFAULT 'Tùy chỉnh cá nhân',
	"values" jsonb NOT NULL,
	"dimensions" jsonb NOT NULL,
	"addAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "SystemSetting" (
	"id" text PRIMARY KEY NOT NULL,
	"webName" text,
	"adminEmail" text,
	"adminPhone" text,
	"colors" jsonb,
	"autoSeason" boolean DEFAULT false,
	"wifiPerf" boolean DEFAULT false,
	"autoBoost" boolean DEFAULT false,
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"username" varchar(255),
	"password" text,
	"role" varchar(50) DEFAULT 'user',
	"profile" jsonb,
	"lastActiveAt" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "VectorDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"category" varchar(150) NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding" jsonb,
	"tenant_id" text,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "VietnameseLexicon" (
	"id" text PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"subType" varchar(100),
	"definition" text,
	"relations" jsonb,
	"addAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "VietnameseLexicon_word_unique" UNIQUE("word")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_hostId_User_id_fk" FOREIGN KEY ("hostId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CropSeason" ADD CONSTRAINT "CropSeason_farmId_Farm_id_fk" FOREIGN KEY ("farmId") REFERENCES "public"."Farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "File" ADD CONSTRAINT "File_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fl_gradient_update" ADD CONSTRAINT "fl_gradient_update_round_id_fl_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."fl_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fl_model_version" ADD CONSTRAINT "fl_model_version_round_id_fl_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."fl_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fl_privacy_budget" ADD CONSTRAINT "fl_privacy_budget_node_id_fl_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."fl_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LabNotebook" ADD CONSTRAINT "LabNotebook_projectId_ResearchProject_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."ResearchProject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LabNotebook" ADD CONSTRAINT "LabNotebook_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_assemblyId_Assembly_id_fk" FOREIGN KEY ("assemblyId") REFERENCES "public"."Assembly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_User_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_User_id_fk" FOREIGN KEY ("sellerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_ResearchProject_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."ResearchProject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_User_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SensorData" ADD CONSTRAINT "SensorData_farmId_Farm_id_fk" FOREIGN KEY ("farmId") REFERENCES "public"."Farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SensorData" ADD CONSTRAINT "SensorData_cropSeasonId_CropSeason_id_fk" FOREIGN KEY ("cropSeasonId") REFERENCES "public"."CropSeason"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StatisticalReport" ADD CONSTRAINT "StatisticalReport_projectId_ResearchProject_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."ResearchProject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StrategyPreset" ADD CONSTRAINT "StrategyPreset_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_memory_session_id" ON "AgentMemory" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_context_key" ON "AgentMemory" USING btree ("contextKey");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_session_context" ON "AgentMemory" USING btree ("sessionId","contextKey");--> statement-breakpoint
CREATE INDEX "idx_agent_training_intent" ON "AgentTraining" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "idx_agent_training_add_at" ON "AgentTraining" USING btree ("addAt");--> statement-breakpoint
CREATE INDEX "idx_chat_message_user_id" ON "ChatMessage" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_chat_message_created_at" ON "ChatMessage" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_crop_season_farm_id" ON "CropSeason" USING btree ("farmId");--> statement-breakpoint
CREATE INDEX "idx_crop_season_status" ON "CropSeason" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feedback_log_add_at" ON "FeedbackLog" USING btree ("addAt");--> statement-breakpoint
CREATE INDEX "idx_feedback_log_rating" ON "FeedbackLog" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_feedback_log_intent" ON "FeedbackLog" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "idx_message_assembly_id" ON "Message" USING btree ("assemblyId");--> statement-breakpoint
CREATE INDEX "idx_natural_language_log_intent" ON "NaturalLanguageLog" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "idx_natural_language_log_add_at" ON "NaturalLanguageLog" USING btree ("addAt");--> statement-breakpoint
CREATE INDEX "idx_negotiation_log_session" ON "NegotiationLog" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "idx_order_user_id" ON "Order" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_order_status" ON "Order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_order_add_at" ON "Order" USING btree ("addAt");--> statement-breakpoint
CREATE INDEX "idx_order_item_order_id" ON "OrderItem" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "idx_order_item_product_id" ON "OrderItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "idx_product_seller_id" ON "Product" USING btree ("sellerId");--> statement-breakpoint
CREATE INDEX "idx_response_version_log_add_at" ON "ResponseVersionLog" USING btree ("addAt");--> statement-breakpoint
CREATE INDEX "idx_response_version_log_version" ON "ResponseVersionLog" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_response_version_log_intent" ON "ResponseVersionLog" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "idx_review_user_id" ON "Review" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_review_product_id" ON "Review" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "idx_rl_qtable_state" ON "RlQTable" USING btree ("stateHash");--> statement-breakpoint
CREATE INDEX "idx_sensor_data_farm_id" ON "SensorData" USING btree ("farmId");--> statement-breakpoint
CREATE INDEX "idx_sensor_data_recorded_at" ON "SensorData" USING btree ("recordedAt");--> statement-breakpoint
CREATE INDEX "idx_sensor_data_farm_time" ON "SensorData" USING btree ("farmId","recordedAt");--> statement-breakpoint
CREATE INDEX "idx_seo_cache_product" ON "SeoCache" USING btree ("productSlug");--> statement-breakpoint
CREATE INDEX "idx_seo_cache_location" ON "SeoCache" USING btree ("locationSlug");--> statement-breakpoint
CREATE INDEX "vector_document_idx" ON "VectorDocument" USING btree ("id");