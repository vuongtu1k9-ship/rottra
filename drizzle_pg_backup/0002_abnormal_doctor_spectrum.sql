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
ALTER TABLE "VectorDocument" ALTER COLUMN "embedding" SET DATA TYPE halfvec(1024);--> statement-breakpoint
ALTER TABLE "VectorDocument" ADD COLUMN "tenant_id" text;--> statement-breakpoint
CREATE INDEX "idx_negotiation_log_session" ON "NegotiationLog" USING btree ("sessionId");