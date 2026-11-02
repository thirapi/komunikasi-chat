CREATE TABLE "PollOption" (
	"id" text PRIMARY KEY NOT NULL,
	"pollId" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PollVote" (
	"id" text PRIMARY KEY NOT NULL,
	"pollId" text NOT NULL,
	"optionId" text NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PollVote_option_user_unq" UNIQUE("optionId","userId")
);
--> statement-breakpoint
CREATE TABLE "Poll" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"question" text NOT NULL,
	"allowMultiple" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Poll_messageId_unique" UNIQUE("messageId")
);
--> statement-breakpoint
CREATE TABLE "SavedMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"messageId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SavedMessage_user_message_unq" UNIQUE("userId","messageId")
);
--> statement-breakpoint
ALTER TABLE "RoomParticipant" ADD COLUMN "archivedAt" timestamp;--> statement-breakpoint
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_Poll_id_fk" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_Poll_id_fk" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_PollOption_id_fk" FOREIGN KEY ("optionId") REFERENCES "public"."PollOption"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SavedMessage" ADD CONSTRAINT "SavedMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SavedMessage" ADD CONSTRAINT "SavedMessage_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "PollOption_pollId_idx" ON "PollOption" USING btree ("pollId");--> statement-breakpoint
CREATE INDEX "PollVote_poll_user_idx" ON "PollVote" USING btree ("pollId","userId");