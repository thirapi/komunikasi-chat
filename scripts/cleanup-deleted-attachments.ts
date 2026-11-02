/**
 * Remove from R2 the files of messages that were deleted before
 * DeleteMessageUseCase started cleaning up storage itself.
 *
 *   npx tsx scripts/cleanup-deleted-attachments.ts          # dry run (default)
 *   npx tsx scripts/cleanup-deleted-attachments.ts --apply  # actually delete
 *
 * Same safety rules as DeleteMessageUseCase:
 * - the key is derived from the URL, which must be on R2_PUBLIC_DOMAIN_URL and
 *   under the message's own room folder (channels/<roomId>/);
 * - a file still attached to any non-deleted message is kept (forwards, or a
 *   URL pasted into another message).
 * Deleting an object that is already gone is a no-op, so re-running is safe.
 */
import "dotenv/config";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

function keyFromPublicUrl(url: string, base: string): string | null {
  const b = base.replace(/\/+$/, "");
  if (!b || !url.startsWith(`${b}/`)) return null;
  try {
    const key = decodeURI(url.slice(b.length + 1).split(/[?#]/)[0]);
    if (!key || key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return null;
    return key;
  } catch {
    return null;
  }
}

async function main() {
  const base = process.env.R2_PUBLIC_DOMAIN_URL ?? "";
  for (const v of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_PUBLIC_DOMAIN_URL"]) {
    if (!process.env[v]) throw new Error(`${v} is not set`);
  }

  // Attachments of deleted messages whose URL no live message still uses.
  const result = await db.execute(sql`
    SELECT DISTINCT a."url", m."roomId"
    FROM "Attachment" a
    JOIN "Message" m ON m."id" = a."messageId"
    WHERE m."isDeleted" = true
      AND NOT EXISTS (
        SELECT 1 FROM "Attachment" a2
        JOIN "Message" m2 ON m2."id" = a2."messageId"
        WHERE a2."url" = a."url" AND m2."isDeleted" = false
      )
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { url: string; roomId: string }[];

  const targets: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const key = keyFromPublicUrl(row.url, base);
    if (key && key.startsWith(`channels/${row.roomId}/`)) targets.push(key);
    else skipped++;
  }

  console.log(`${rows.length} file(s) of deleted messages not used elsewhere.`);
  console.log(`${targets.length} can be removed, ${skipped} skipped (not our R2 URL or outside the room folder).`);
  if (!APPLY) {
    targets.slice(0, 20).forEach((k) => console.log(`  would delete ${k}`));
    if (targets.length > 20) console.log(`  … and ${targets.length - 20} more`);
    console.log("Dry run. Re-run with --apply to delete.");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
  let done = 0;
  let failed = 0;
  for (const key of targets) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      done++;
    } catch (err) {
      failed++;
      console.error(`  failed ${key}:`, (err as Error).message);
    }
  }
  console.log(`Deleted ${done}, failed ${failed}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
