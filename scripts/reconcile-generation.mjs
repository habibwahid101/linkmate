#!/usr/bin/env node
/**
 * Idempotent generation/commission backfill.
 *
 * Default is dry-run. Apply with APPLY=1.
 * Never reverses RELEASED wallet rows. Inserts missing HELD memberships/commissions
 * then recounts. Safe to run more than once.
 *
 *   DATABASE_URL=... node --experimental-strip-types scripts/reconcile-generation.mjs
 *   DATABASE_URL=... APPLY=1 node --experimental-strip-types scripts/reconcile-generation.mjs
 */
import pg from "pg";
import { reconcileGenerationAncestry } from "../src/lib/engine/process.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const apply = process.env.APPLY === "1" || process.env.APPLY === "true";
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

function sql(strings, ...values) {
  let text = strings[0] ?? "";
  for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
  return pool.query(text, values).then((r) => r.rows);
}

try {
  const report = await reconcileGenerationAncestry(sql, { dryRun: !apply });
  console.log(JSON.stringify({ apply, ...report }, null, 2));
  if (!apply && report.wouldRelease.length > 0) {
    console.log("[reconcile] dry-run would newly release levels (additive ledger, no clawback):");
    console.log(JSON.stringify(report.wouldRelease, null, 2));
  }
} finally {
  await pool.end();
}
