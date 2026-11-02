/**
 * Prove the migrations in drizzle/ build the schema the code expects, on a
 * throwaway Postgres, before they ever reach production.
 *
 *   docker compose up -d postgres
 *   MIGRATION_TEST_DATABASE_URL=postgres://postgres:password@localhost:5432/mydb npm run verify:migrations
 *
 * 1. wipes the test database (public + drizzle schemas),
 * 2. runs every migration from scratch with drizzle's own migrator,
 * 3. checks that every table and column declared in schema.ts exists,
 * 4. runs the migrator again, which must be a no-op.
 *
 * It refuses to touch anything that looks like a real database (Neon hosts,
 * or the same URL as DATABASE_URL), because step 1 deletes everything.
 */
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../src/lib/infrastructure/drizzle/schema";

config();

async function main() {
  const url = process.env.MIGRATION_TEST_DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_TEST_DATABASE_URL to a throwaway Postgres database.");
  if (url === process.env.DATABASE_URL || /neon\.tech|neon\.build/i.test(url)) {
    throw new Error("Refusing to run: MIGRATION_TEST_DATABASE_URL looks like a real database. This script wipes it.");
  }

  const pool = new Pool({ connectionString: url });
  const q = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as Record<string, any>[];
  try {
    await q(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await q(`DROP SCHEMA IF EXISTS public CASCADE`);
    await q(`CREATE SCHEMA public`);

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "drizzle" });
    const applied = (await q(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n;
    console.log(`✓ ${applied} migrations applied from scratch`);

    const columns = await q(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    const present = new Set(columns.map((c) => `${c.table_name}.${c.column_name}`));
    const missing: string[] = [];
    let tables = 0;
    for (const value of Object.values(schema)) {
      if (!(value instanceof PgTable)) continue;
      const cfg = getTableConfig(value);
      tables++;
      for (const col of cfg.columns) {
        if (!present.has(`${cfg.name}.${col.name}`)) missing.push(`${cfg.name}.${col.name}`);
      }
    }
    if (missing.length) {
      throw new Error(`schema.ts declares columns the migrations never create:\n  ${missing.join("\n  ")}`);
    }
    console.log(`✓ all ${tables} tables in schema.ts exist with every column`);

    await migrate(db, { migrationsFolder: "drizzle" });
    const again = (await q(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n;
    if (again !== applied) throw new Error("Running the migrations a second time applied something again.");
    console.log("✓ re-running is a no-op");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
