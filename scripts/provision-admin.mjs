#!/usr/bin/env node
/**
 * Ensure an existing signed-up user has an app_users row, then promote to admin.
 *
 * Usage:
 *   DATABASE_URL=postgres://... ADMIN_EMAIL=you@example.com node scripts/provision-admin.mjs
 *
 * Never auto-promotes the first public user. Never invents credentials.
 */
import pg from "pg";
import { randomUUID } from "node:crypto";

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

function referralCode(seed) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let n = h >>> 0;
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.imul(n, 1664525) + 1013904223;
    n >>>= 0;
  }
  return out;
}

try {
  const auth = await pool.query(`select id, email, name from "user" where lower(email) = $1`, [email]);
  if (!auth.rows[0]) {
    console.error(`No auth user for ${email}. Sign up first, then re-run.`);
    process.exit(2);
  }
  const userId = auth.rows[0].id;
  const displayName = auth.rows[0].name || "Member";
  const authEmail = auth.rows[0].email;

  const existing = await pool.query(`select user_id, role from app_users where user_id = $1`, [userId]);
  if (!existing.rows[0]) {
    let code = referralCode(`${userId}:${Date.now()}`);
    for (let i = 0; i < 6; i++) {
      const clash = await pool.query(`select 1 from app_users where referral_code = $1`, [code]);
      if (clash.rowCount === 0) break;
      code = referralCode(`${userId}:${i}:${Math.random()}`);
    }
    await pool.query(
      `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
       values ($1, $2, $3, 'member', $4, false)
       on conflict (user_id) do nothing`,
      [userId, displayName, authEmail, code],
    );
    console.log(`Created missing app_users row for ${email} (${userId}) as member.`);
  }

  const before = await pool.query(`select user_id, role from app_users where user_id = $1`, [userId]);
  if (!before.rows[0]) {
    console.error(`app_users row still missing for ${email}`);
    process.exit(2);
  }
  if (before.rows[0].role !== "admin") {
    await pool.query(`update app_users set role = 'admin' where user_id = $1`, [userId]);
    await pool.query(
      `insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
       values ($1, $2, 'user.role', 'app_users', $2, 'admin provision-admin.mjs')`,
      [randomUUID(), userId],
    );
    console.log(`Promoted ${email} (${userId}) to admin.`);
  } else {
    console.log(`${email} (${userId}) is already admin.`);
  }

  const verify = await pool.query(
    `select u.id as auth_id, a.user_id, a.role, a.email
     from "user" u join app_users a on a.user_id = u.id
     where lower(u.email) = $1`,
    [email],
  );
  const row = verify.rows[0];
  if (!row || row.role !== "admin" || row.auth_id !== row.user_id) {
    console.error("Verification failed", row);
    process.exit(3);
  }
  console.log(`Verified admin mapping auth_id=${row.auth_id} app_user_id=${row.user_id} role=${row.role}`);
} finally {
  await pool.end();
}
