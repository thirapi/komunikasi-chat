CREATE TABLE "UserBlock" (
	"id" text PRIMARY KEY NOT NULL,
	"blockerId" text NOT NULL,
	"blockedId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserBlock_pair_unq" UNIQUE("blockerId","blockedId")
);
--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "isForwarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "lastSeenAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "showLastSeen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "readReceipts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_User_id_fk" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_User_id_fk" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock" USING btree ("blockedId");