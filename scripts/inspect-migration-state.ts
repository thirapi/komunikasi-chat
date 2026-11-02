/**
 * Read-only: shows which migrations the database has recorded and which of
 * their effects actually exist, to untangle a database whose schema was
 * partly changed with `db:push` (so `db:migrate` replays old migrations).
 *
 *   npx tsx scripts/inspect-migration-state.ts
 *
 * Runs SELECTs only.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const q = async (sql: string) => (await pool.query(sql)).rows as Record<string, any>[];

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  const recorded = await q(`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`).catch(
    (e) => {
      console.log("drizzle.__drizzle_migrations not readable:", e.message);
      return [];
    },
  );
  const recordedHashes = new Set(recorded.map((r) => r.hash));
  // Drizzle runs every journal entry whose `when` is newer than the newest
  // recorded created_at (not a per-hash check), all in one transaction.
  const last = recorded.length ? Math.max(...recorded.map((r) => Number(r.created_at))) : 0;
  console.log(`Recorded migrations: ${recorded.length}, newest recorded: ${last ? new Date(last).toISOString() : "none"}`);
  for (const e of journal.entries) {
    const hash = createHash("sha256").update(readFileSync(`drizzle/${e.tag}.sql`, "utf8")).digest("hex");
    const pending = e.when > last;
    if (pending || e.idx >= journal.entries.length - 6) {
      console.log(`  ${pending ? "PENDING" : "applied"}  ${e.tag}${recordedHashes.has(hash) ? "" : pending ? "" : "  (hash differs)"}`);
    }
  }

  const exists = async (table: string, column?: string) =>
    (
      await q(
        column
          ? `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}'`
          : `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'`,
      )
    ).length > 0;
  const index = async (name: string) =>
    (await q(`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='${name}'`)).length > 0;

  console.log("\nEffects present in the database:");
  const checks: [string, Promise<boolean>][] = [
    ["0026: table Post is gone", exists("Post").then((v) => !v)],
    ["0026: Attachment.postId is gone", exists("Attachment", "postId").then((v) => !v)],
    ["0027: index Message_roomId_createdAt_idx", index("Message_roomId_createdAt_idx")],
    ["0028: Message.pinnedAt", exists("Message", "pinnedAt")],
    ["0028: Message.editedAt", exists("Message", "editedAt")],
    ["0028: RoomParticipant.mutedUntil", exists("RoomParticipant", "mutedUntil")],
    ["0028: table LinkPreview", exists("LinkPreview")],
    ["0029: Message.isForwarded", exists("Message", "isForwarded")],
    ["0029: User.lastSeenAt", exists("User", "lastSeenAt")],
    ["0029: table UserBlock", exists("UserBlock")],
    ["0030: RoomParticipant.archivedAt", exists("RoomParticipant", "archivedAt")],
    ["0030: table Poll", exists("Poll")],
    ["0030: table SavedMessage", exists("SavedMessage")],
  ];
  for (const [label, check] of checks) console.log(`  ${(await check) ? "yes" : "NO "}  ${label}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
