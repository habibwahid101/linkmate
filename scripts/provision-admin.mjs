#!/usr/bin/env node
/**
 * Promote an existing signed-up user to admin.
 *
 * Usage:
 *   DATABASE_URL=postgres://... ADMIN_EMAIL=you@example.com node scripts/provision-admin.mjs
 *
 * The person must already have created an account via sign-up. This script
 * never auto-promotes the first public user.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const email = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!email) {
  console.error("ADMIN_EMAIL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const auth = await pool.query(`select id, email, name from "user" where lower(email) = $1`, [email]);
  if (!auth.rows[0]) {
    console.error(`No auth user for ${email}. Sign up first, then re-run.`);
    process.exit(2);
  }
  const userId = auth.rows[0].id;
  const existing = await pool.query(`select user_id, role from app_users where user_id = $1`, [userId]);
  if (!existing.rows[0]) {
    console.error(`app_users row missing for ${email}. Sign in once so the profile is created, then re-run.`);
    process.exit(2);
  }
  await pool.query(`update app_users set role = 'admin' where user_id = $1`, [userId]);
  await pool.query(
    `insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
     values ($1, $2, 'user.role', 'app_users', $2, 'admin provision-admin.mjs')`,
    [crypto.randomUUID(), userId],
  );
  console.log(`Promoted ${email} (${userId}) to admin.`);
} finally {
  await pool.end();
}
