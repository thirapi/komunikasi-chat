/**
 * Guard for scripts that wipe or rewrite data (db:reset, db:seed, dev:clean).
 * They only run against a local database. On 2026-11-02 `npm run db:reset`
 * ran with the production DATABASE_URL from .env and dropped every table.
 *
 * To really run one against a remote database (e.g. a fresh, empty branch):
 *   ALLOW_REMOTE_DB_WRITE=<that database's host> npm run db:reset
 */
export function assertLocalDatabase(scriptName: string) {
  const raw = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    console.error(`✋ ${scriptName}: DATABASE_URL is missing or invalid.`);
    process.exit(1);
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "host.docker.internal"].includes(host);
  if (local || process.env.ALLOW_REMOTE_DB_WRITE === host) return;
  console.error(
    [
      `✋ ${scriptName} refused: DATABASE_URL points at "${host}", not a local database.`,
      `   This script deletes or overwrites data. Point DATABASE_URL at a local Postgres`,
      `   (docker compose up -d postgres), or if this really is a throwaway database run:`,
      `   ALLOW_REMOTE_DB_WRITE=${host} npm run ${scriptName}`,
    ].join("\n"),
  );
  process.exit(1);
}
