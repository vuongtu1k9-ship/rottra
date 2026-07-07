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
	"en" text NOT NULL,
	"vi" text NOT NULL,
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
	"autoBot" boolean DEFAULT false,
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
ALTER TABLE "CropSeason" ADD CONSTRAINT "CropSeason_farmId_Farm_id_fk" FOREIGN KEY ("farmId") REFERENCES "public"."Farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "File" ADD CONSTRAINT "File_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "StrategyPreset" ADD CONSTRAINT "StrategyPreset_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;