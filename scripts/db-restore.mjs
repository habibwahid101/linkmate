#!/usr/bin/env node
/**
 * Isolated restore of a JSON export from scripts/db-export.mjs.
 *
 * NEVER restore over live production. This script refuses APP_ENV=production
 * and VERCEL_ENV=production. Point DATABASE_URL at a temporary Neon branch
 * or empty Postgres database.
 *
 * Required:
 *   RESTORE_CONFIRM=ISOLATED_RESTORE_ONLY
 *   DATABASE_URL=postgres://...   (isolated target)
 *
 * Steps:
 *   1. Create a Neon restore branch (or empty Postgres) — not the live DB.
 *   2. APP_ENV= DATABASE_URL=<isolated> npm run db:migrate
 *   3. RESTORE_CONFIRM=ISOLATED_RESTORE_ONLY DATABASE_URL=<isolated> \
 *        npm run db:restore -- /path/to/export.json
 *   4. Compare printed counts with the export file.
 *   5. Delete the temporary branch/database.
 *
 * Neon PITR restore (platform, preferred for production incidents):
 *   - In the Neon/Grok database console, restore the production branch to a
 *     new branch at the chosen timestamp (within the history window).
 *   - Verify row counts there. Do not reset the live branch until verified.
 *   - Grok App Builder does not expose Neon console access from this sandbox,
 *     so that restore must be performed by the operator who owns the project.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { RESTORE_ORDER, sqlTable } from "./durable-tables.mjs";

if (
  process.env.APP_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
) {
  console.error(
    "[db-restore] Refusing to restore into a production-flagged process. Use an isolated DATABASE_URL without APP_ENV=production.",
  );
  process.exit(1);
}

if (process.env.RESTORE_CONFIRM !== "ISOLATED_RESTORE_ONLY") {
  console.error(
    "[db-restore] Set RESTORE_CONFIRM=ISOLATED_RESTORE_ONLY to load into an isolated database.",
  );
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error("[db-restore] Isolated PostgreSQL DATABASE_URL is required.");
  process.exit(1);
}

const inPath = process.argv[2];
if (!inPath) {
  console.error("[db-restore] Usage: npm run db:restore -- ./export.json");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(inPath, "utf8"));
if (!payload?.tables || typeof payload.tables !== "object") {
  console.error("[db-restore] Invalid export file.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const table of RESTORE_ORDER) {
    const ident = sqlTable(table);
    const block = payload.tables[table];
    if (!block || block.missing || !Array.isArray(block.rows) || block.rows.length === 0) {
      continue;
    }
    for (const row of block.rows) {
      const cols = Object.keys(row).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c));
      if (cols.length === 0) continue;
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const values = cols.map((c) => row[c]);
      await client.query(
        `insert into ${ident} (${cols.map((c) => `"${c}"`).join(", ")}) values (${placeholders.join(", ")}) on conflict do nothing`,
        values,
      );
    }
  }
  await client.query("COMMIT");

  console.log("[db-restore] restored from", payload.exported_at ?? "unknown");
  for (const table of RESTORE_ORDER) {
    const ident = sqlTable(table);
    const exists = await client.query("select to_regclass($1) as name", [ident]);
    if (!exists.rows[0]?.name) {
      console.log(`  ${table}: missing`);
      continue;
    }
    const count = await client.query(`select count(*)::int as n from ${ident}`);
    const expected = payload.tables[table]?.count ?? payload.tables[table]?.rows?.length ?? 0;
    console.log(`  ${table}: ${count.rows[0].n} rows (export ${expected})`);
  }
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // keep original
  }
  console.error("[db-restore] failed:", err?.message || err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
