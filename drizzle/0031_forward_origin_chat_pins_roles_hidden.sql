CREATE TABLE "HiddenMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"messageId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "HiddenMessage_user_message_unq" UNIQUE("userId","messageId")
);
--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "forwardedFromUserId" text;--> statement-breakpoint
ALTER TABLE "RoomParticipant" ADD COLUMN "pinnedAt" timestamp;--> statement-breakpoint
ALTER TABLE "RoomParticipant" ADD COLUMN "markedUnread" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "RoomParticipant" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "HiddenMessage" ADD CONSTRAINT "HiddenMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HiddenMessage" ADD CONSTRAINT "HiddenMessage_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;