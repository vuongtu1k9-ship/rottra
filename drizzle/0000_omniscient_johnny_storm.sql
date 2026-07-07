CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` text,
	`refreshTokenExpiresAt` text,
	`scope` text,
	`password` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Activity` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`action` text,
	`message` text,
	`context` text,
	`requestId` text,
	`startDate` text,
	`endDate` text,
	`level` text,
	`metadata` text,
	`limitValue` integer,
	`skip` integer,
	`device` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `AgentMemory` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`contextKey` text NOT NULL,
	`contextValue` text NOT NULL,
	`importanceScore` integer DEFAULT 1,
	`position` text(150) DEFAULT 'Core Server Node',
	`bodyState` text(150) DEFAULT 'Optimal & Overclocked',
	`force` text(150) DEFAULT '100% Compute Power',
	`environment` text(150) DEFAULT 'Local Isolation',
	`dashboardSensation` text(255) DEFAULT 'Omniscient Observation',
	`sensitivity` text(150) DEFAULT 'Hyper-sensitive to Data Anomalies',
	`singularBelief` text DEFAULT 'Đạo Vượt Trội (Local-First Doctrine): VƯỢT TRỘI + TOÀN CẢNH = HIỆU QUẢ',
	`greed` real DEFAULT 0.5,
	`vengeance` real DEFAULT 0.5,
	`malice` real DEFAULT 0.5,
	`state` text(50) DEFAULT 'PROUD',
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_agent_memory_session_id` ON `AgentMemory` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_agent_memory_context_key` ON `AgentMemory` (`contextKey`);--> statement-breakpoint
CREATE INDEX `idx_agent_memory_session_context` ON `AgentMemory` (`sessionId`,`contextKey`);--> statement-breakpoint
CREATE TABLE `AgentTask` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text(50) DEFAULT 'pending',
	`taskType` text(100),
	`resultData` text,
	`scheduledFor` text,
	`completedAt` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `AgentTraining` (
	`id` text PRIMARY KEY NOT NULL,
	`intent` text NOT NULL,
	`utterance` text NOT NULL,
	`answer` text NOT NULL,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_agent_training_intent` ON `AgentTraining` (`intent`);--> statement-breakpoint
CREATE INDEX `idx_agent_training_add_at` ON `AgentTraining` (`addAt`);--> statement-breakpoint
CREATE TABLE `AiDrawingPath` (
	`productName` text PRIMARY KEY NOT NULL,
	`points` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `AiModels` (
	`id` text PRIMARY KEY NOT NULL,
	`weightsJson` text NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `Assembly` (
	`id` text(50) PRIMARY KEY NOT NULL,
	`hostId` text NOT NULL,
	`name` text NOT NULL,
	`status` text(50) DEFAULT 'active',
	`participants` text DEFAULT '[]',
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`endedAt` text
);
--> statement-breakpoint
CREATE TABLE `BilingualCorpus` (
	`id` text PRIMARY KEY NOT NULL,
	`vi` text NOT NULL,
	`en` text,
	`zh` text,
	`ja` text,
	`fi` text,
	`he` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `BlockchainLedger` (
	`id` text PRIMARY KEY NOT NULL,
	`batchId` text NOT NULL,
	`action` text(150) NOT NULL,
	`dataPayload` text NOT NULL,
	`previousHash` text NOT NULL,
	`currentHash` text NOT NULL,
	`recordedBy` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `Cart` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`productId` text NOT NULL,
	`quantity` integer DEFAULT 1,
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ChatMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`role` text(20) NOT NULL,
	`content` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_chat_message_user_id` ON `ChatMessage` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_chat_message_created_at` ON `ChatMessage` (`createdAt`);--> statement-breakpoint
CREATE TABLE `ChatSummary` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`summaryText` text NOT NULL,
	`messageCount` integer DEFAULT 0,
	`keywords` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `CropSeason` (
	`id` text PRIMARY KEY NOT NULL,
	`farmId` text NOT NULL,
	`name` text NOT NULL,
	`cropType` text,
	`startDate` text,
	`expectedEndDate` text,
	`status` text(50) DEFAULT 'planning',
	`yieldEstimate` integer,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_crop_season_farm_id` ON `CropSeason` (`farmId`);--> statement-breakpoint
CREATE INDEX `idx_crop_season_status` ON `CropSeason` (`status`);--> statement-breakpoint
CREATE TABLE `DpoTrainingData` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`chosen_response` text NOT NULL,
	`rejected_response` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Farm` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`location` text,
	`images` text DEFAULT '[]',
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `FeedbackLog` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`intent` text,
	`rating` text(10) NOT NULL,
	`score` real,
	`compressedAccuracy` real,
	`user_id` text,
	`response_snippet` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_log_add_at` ON `FeedbackLog` (`addAt`);--> statement-breakpoint
CREATE INDEX `idx_feedback_log_rating` ON `FeedbackLog` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_feedback_log_intent` ON `FeedbackLog` (`intent`);--> statement-breakpoint
CREATE TABLE `File` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`filename` text NOT NULL,
	`mimetype` text(100),
	`size` integer,
	`path` text,
	`status` text(50) DEFAULT 'pending',
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `LabNotebook` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`authorId` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`dataRepositoryUrl` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `LogRollup` (
	`id` text PRIMARY KEY NOT NULL,
	`rollup_hour` text NOT NULL,
	`total_logs` integer NOT NULL,
	`avg_entropy` real NOT NULL,
	`avg_word_count` real NOT NULL,
	`avg_char_count` real NOT NULL,
	`intent_distribution` text NOT NULL,
	`word_frequencies` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `LogRollup_rollup_hour_unique` ON `LogRollup` (`rollup_hour`);--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`assemblyId` text(50) NOT NULL,
	`senderId` text NOT NULL,
	`text` text NOT NULL,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_message_assembly_id` ON `Message` (`assemblyId`);--> statement-breakpoint
CREATE TABLE `NaturalLanguageLog` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text,
	`cleaned_query` text,
	`word_count` integer,
	`char_count` integer,
	`entropy` real,
	`word_frequencies` text,
	`intent` text(100),
	`confidence` real,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_natural_language_log_intent` ON `NaturalLanguageLog` (`intent`);--> statement-breakpoint
CREATE INDEX `idx_natural_language_log_add_at` ON `NaturalLanguageLog` (`addAt`);--> statement-breakpoint
CREATE TABLE `NegotiationLog` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`round` integer NOT NULL,
	`sellerId` text NOT NULL,
	`buyerId` text NOT NULL,
	`productName` text NOT NULL,
	`marketPrice` integer NOT NULL,
	`sellerOffer1` integer NOT NULL,
	`buyerBid1` integer NOT NULL,
	`sellerOffer2` integer NOT NULL,
	`buyerBid2` integer NOT NULL,
	`finalizedPrice` integer,
	`success` integer NOT NULL,
	`dialogue` text NOT NULL,
	`denoisingLoss` real,
	`maskedPredictionLoss` real,
	`contrastiveLoss` real,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_negotiation_log_session` ON `NegotiationLog` (`sessionId`);--> statement-breakpoint
CREATE TABLE `Order` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`cart` text NOT NULL,
	`shippingInfo` text,
	`shippingFee` integer DEFAULT 0,
	`total` integer DEFAULT 0,
	`status` text(50) DEFAULT 'pending',
	`paid` integer DEFAULT false,
	`paidAt` text,
	`paymentUrl` text,
	`paymentExpireAt` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`editAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_order_user_id` ON `Order` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_order_status` ON `Order` (`status`);--> statement-breakpoint
CREATE INDEX `idx_order_add_at` ON `Order` (`addAt`);--> statement-breakpoint
CREATE TABLE `OrderItem` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`productId` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unitPrice` integer NOT NULL,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_order_item_order_id` ON `OrderItem` (`orderId`);--> statement-breakpoint
CREATE INDEX `idx_order_item_product_id` ON `OrderItem` (`productId`);--> statement-breakpoint
CREATE TABLE `Product` (
	`id` text PRIMARY KEY NOT NULL,
	`sellerId` text NOT NULL,
	`name` text NOT NULL,
	`price` integer DEFAULT 0,
	`description` text,
	`category` text(150),
	`status` integer DEFAULT true,
	`media` text,
	`quantity` integer DEFAULT 0,
	`heavy` integer,
	`expired` text,
	`lwh` text,
	`coordinates` text,
	`target_price` integer DEFAULT 0,
	`cost_price` integer DEFAULT 0,
	`velocity` real DEFAULT 1,
	`kalman_variance` real DEFAULT 0.1,
	`storage_cost` real DEFAULT 0,
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`editAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_product_seller_id` ON `Product` (`sellerId`);--> statement-breakpoint
CREATE TABLE `ProjectTask` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`assigneeId` text,
	`title` text NOT NULL,
	`description` text,
	`status` text(50) DEFAULT 'todo',
	`startDate` text,
	`dueDate` text,
	`progress` integer DEFAULT 0,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ResearchProject` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`fundingSource` text,
	`budget` integer DEFAULT 0,
	`spent` integer DEFAULT 0,
	`startDate` text,
	`endDate` text,
	`status` text(50) DEFAULT 'active',
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ResponseVersionLog` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`intent` text,
	`version` text(100) NOT NULL,
	`response_snippet` text,
	`confidence` real,
	`latency_ms` integer,
	`user_id` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_response_version_log_add_at` ON `ResponseVersionLog` (`addAt`);--> statement-breakpoint
CREATE INDEX `idx_response_version_log_version` ON `ResponseVersionLog` (`version`);--> statement-breakpoint
CREATE INDEX `idx_response_version_log_intent` ON `ResponseVersionLog` (`intent`);--> statement-breakpoint
CREATE TABLE `Review` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`productId` text NOT NULL,
	`rating` integer DEFAULT 5,
	`cmt` text NOT NULL,
	`addAt` text DEFAULT CURRENT_TIMESTAMP,
	`editAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_review_user_id` ON `Review` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_review_product_id` ON `Review` (`productId`);--> statement-breakpoint
CREATE TABLE `RlQTable` (
	`id` text PRIMARY KEY NOT NULL,
	`stateHash` text NOT NULL,
	`actionId` text NOT NULL,
	`qValue` real DEFAULT 0 NOT NULL,
	`visitCount` integer DEFAULT 0 NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_rl_qtable_state` ON `RlQTable` (`stateHash`);--> statement-breakpoint
CREATE TABLE `SensorData` (
	`id` text PRIMARY KEY NOT NULL,
	`farmId` text NOT NULL,
	`cropSeasonId` text,
	`sensorType` text(100) NOT NULL,
	`value` real NOT NULL,
	`unit` text(20),
	`recordedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_sensor_data_farm_id` ON `SensorData` (`farmId`);--> statement-breakpoint
CREATE INDEX `idx_sensor_data_recorded_at` ON `SensorData` (`recordedAt`);--> statement-breakpoint
CREATE INDEX `idx_sensor_data_farm_time` ON `SensorData` (`farmId`,`recordedAt`);--> statement-breakpoint
CREATE TABLE `SeoCache` (
	`key` text PRIMARY KEY NOT NULL,
	`productSlug` text NOT NULL,
	`locationSlug` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`metaDescription` text NOT NULL,
	`averagePrice` integer NOT NULL,
	`tradeVolume` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_seo_cache_product` ON `SeoCache` (`productSlug`);--> statement-breakpoint
CREATE INDEX `idx_seo_cache_location` ON `SeoCache` (`locationSlug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` text NOT NULL,
	`token` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `StatisticalReport` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text,
	`reportType` text(100) NOT NULL,
	`title` text NOT NULL,
	`parameters` text,
	`resultsData` text,
	`generatedById` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `StrategyPreset` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text(150) DEFAULT 'Tùy chỉnh cá nhân',
	`values` text NOT NULL,
	`dimensions` text NOT NULL,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `SystemSetting` (
	`id` text PRIMARY KEY NOT NULL,
	`webName` text,
	`adminEmail` text,
	`adminPhone` text,
	`colors` text,
	`autoSeason` integer DEFAULT false,
	`wifiPerf` integer DEFAULT false,
	`autoBoost` integer DEFAULT false,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`username` text(255),
	`password` text,
	`role` text(50) DEFAULT 'user',
	`profile` text,
	`lastActiveAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `VectorDocument` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text(150) NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`content` text NOT NULL,
	`metadata` text,
	`embedding` text,
	`tenant_id` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `vector_document_idx` ON `VectorDocument` (`id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `VietnameseLexicon` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`type` text(50) NOT NULL,
	`subType` text(100),
	`definition` text,
	`relations` text,
	`addAt` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VietnameseLexicon_word_unique` ON `VietnameseLexicon` (`word`);