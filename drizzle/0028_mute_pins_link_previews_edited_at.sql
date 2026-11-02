CREATE TABLE "LinkPreview" (
	"url" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"description" text,
	"image" text,
	"siteName" text,
	"fetchedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "pinnedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "pinnedBy" text;--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "editedAt" timestamp;--> statement-breakpoint
ALTER TABLE "RoomParticipant" ADD COLUMN "mutedUntil" timestamp;--> statement-breakpoint
-- Backfill: before this column, "edited" was read from updatedAt being more
-- than a second after createdAt. Keep that for existing rows, except where
-- updatedAt only moved because a reaction was added (delta sync bumps
-- updatedAt on reactions since the previous release).
UPDATE "Message" m
SET "editedAt" = m."updatedAt"
WHERE m."isDeleted" = false
  AND m."updatedAt" > m."createdAt" + interval '1 second'
  AND NOT EXISTS (
    SELECT 1 FROM "MessageReaction" r
    WHERE r."messageId" = m."id"
      AND r."createdAt" BETWEEN m."updatedAt" - interval '5 seconds' AND m."updatedAt" + interval '5 seconds'
  );
