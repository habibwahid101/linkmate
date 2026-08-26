#!/usr/bin/env node
/**
 * Manual logical export of Link Mate durable tables.
 *
 * Preview (no DATABASE_URL): exits 2 — PGLite is ephemeral and not a backup source.
 * Production: dumps JSON (redirect to an encrypted file you control).
 *
 * This is an off-platform recovery aid. It does not replace Neon PITR.
 *
 *   DATABASE_URL=postgres://... npm run db:export -- /tmp/linkmate-export.json
 *
 * Restore into an isolated database only — see scripts/db-restore.mjs.
 */
import { writeFileSync } from "node:fs";
import pg from "pg";
import { DURABLE_TABLES, sqlTable } from "./durable-tables.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "[db-export] DATABASE_URL is not set. Preview/PGLite is not a backup source.",
  );
  process.exit(2);
}
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error("[db-export] DATABASE_URL is not PostgreSQL.");
  process.exit(1);
}

const outPath = process.argv[2];

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const client = await pool.connect();
  try {
    const payload = {
      exported_at: new Date().toISOString(),
      tables: {},
    };
    for (const table of DURABLE_TABLES) {
      const ident = sqlTable(table);
      const exists = await client.query("select to_regclass($1) as name", [ident]);
      if (!exists.rows[0]?.name) {
        payload.tables[table] = { missing: true, count: 0, rows: [] };
        continue;
      }
      const result = await client.query(`select * from ${ident}`);
      payload.tables[table] = {
        count: result.rowCount ?? result.rows.length,
        rows: result.rows,
      };
    }
    const json = JSON.stringify(payload);
    if (outPath) {
      writeFileSync(outPath, json);
      console.error(`[db-export] wrote ${outPath}`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
