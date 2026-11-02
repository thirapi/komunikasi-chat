-- OPT-IN, DESTRUCTIVE. Removes the old microblog / Fediverse tables and
-- columns (and all their data) that the app no longer uses. This is what the
-- original drizzle/0026 did, fixed so it can run (IF EXISTS everywhere; the
-- CASCADE drops already remove the foreign keys). Take a backup first.
--
--   psql "$DATABASE_URL" -f scripts/sql/drop-microblog-tables.sql
BEGIN;
DROP TABLE IF EXISTS "AccountFilter" CASCADE;
DROP TABLE IF EXISTS "Bookmark" CASCADE;
DROP TABLE IF EXISTS "Follower" CASCADE;
DROP TABLE IF EXISTS "Hashtag" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "PostHashtag" CASCADE;
DROP TABLE IF EXISTS "PostLinkPreview" CASCADE;
DROP TABLE IF EXISTS "PostReaction" CASCADE;
DROP TABLE IF EXISTS "Post" CASCADE;
DROP TABLE IF EXISTS "RemoteActor" CASCADE;
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "postId";
ALTER TABLE "MessageReaction" DROP COLUMN IF EXISTS "remoteActorId";
ALTER TABLE "PushSubscription" DROP COLUMN IF EXISTS "remoteActorId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "publicKey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "privateKey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "alsoKnownAs";
ALTER TABLE "User" DROP COLUMN IF EXISTS "movedTo";
COMMIT;
