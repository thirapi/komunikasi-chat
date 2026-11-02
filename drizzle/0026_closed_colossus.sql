-- Rewritten (2026-11-02). The generated version could never run: its
-- DROP TABLE "Post" CASCADE already removed "Attachment_postId_Post_id_fk",
-- so the later DROP CONSTRAINT of that name failed and every migration after
-- this one stayed pending. It also dropped the old microblog/Fediverse tables
-- and columns with their data. Only the non-destructive part the current code
-- needs is kept here, written to be safe to re-run; dropping the old tables is
-- a separate, opt-in step: scripts/sql/drop-microblog-tables.sql.
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "PushSubscription" ALTER COLUMN "p256dh" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "PushSubscription" ALTER COLUMN "auth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "PushSubscription" ALTER COLUMN "updatedAt" DROP NOT NULL;
