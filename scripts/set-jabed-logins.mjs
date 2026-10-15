/**
 * Create three Jabed logins and move the three IDs to them.
 * Does not change the existing admin password.
 *
 *   CONFIRM=SET-JABED-LOGINS CHECK_PASSWORD_B64=... node scripts/set-jabed-logins.mjs
 */
import pg from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@better-auth/utils/password";

const ADMIN_EMAIL = "linkmateglobal@gmail.com";
const CHAIN = [
  { memberId: "LM-100001", email: "linkmateglobal+jabed1@gmail.com", name: "Jabed-1", code: "JB1ACC" },
  { memberId: "LM-100002", email: "linkmateglobal+jabed2@gmail.com", name: "Jabed-2", code: "JB2ACC" },
  { memberId: "LM-100003", email: "linkmateglobal+jabed3@gmail.com", name: "Jabed-3", code: "JB3ACC" },
];

if (process.env.CONFIRM !== "SET-JABED-LOGINS") {
  console.error("Refusing: CONFIRM token missing");
  process.exit(1);
}
const password = process.env.CHECK_PASSWORD_B64
  ? Buffer.from(process.env.CHECK_PASSWORD_B64, "base64").toString("utf8")
  : "";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !password) {
  console.error("DATABASE_URL and CHECK_PASSWORD_B64 are required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

async function ensureLogin(row, passwordHash) {
  const existing = await client.query(`select id from "user" where lower(email) = $1`, [row.email]);
  const userId = existing.rows[0]?.id ?? randomUUID();
  if (!existing.rows[0]) {
    await client.query(
      `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, true, now(), now())`,
      [userId, row.name, row.email],
    );
  }
  const account = await client.query(
    `select id from "account" where "userId" = $1 and "providerId" = 'credential'`,
    [userId],
  );
  if (!account.rows[0]) {
    await client.query(
      `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), userId, passwordHash],
    );
  } else {
    await client.query(
      `update "account" set password = $2, "updatedAt" = now()
       where "userId" = $1 and "providerId" = 'credential'`,
      [userId, passwordHash],
    );
  }
  await client.query(
    `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic, active_id)
     values ($1, $2, $3, 'member', $4, false, $5)
     on conflict (user_id) do update
       set display_name = excluded.display_name,
           email = excluded.email,
           active_id = excluded.active_id`,
    [userId, row.name, row.email, row.code, row.memberId],
  );
  return userId;
}

try {
  const admin = await client.query(
    `select u.id, a.password
     from "user" u
     join "account" a on a."userId" = u.id and a."providerId" = 'credential'
     where lower(u.email) = $1`,
    [ADMIN_EMAIL],
  );
  if (admin.rows.length !== 1) throw new Error("Admin login was not found");
  const adminId = admin.rows[0].id;
  const adminHash = admin.rows[0].password;
  const owned = await client.query(
    `select id, owner_user_id from member_ids
     where id in ('LM-100001','LM-100002','LM-100003')
     order by id`,
  );
  if (owned.rows.length !== 3) throw new Error("The three IDs were not found");

  const passwordHash = await hashPassword(password);
  await client.query("begin");
  const created = [];
  for (const row of CHAIN) {
    const userId = await ensureLogin(row, passwordHash);
    if (userId === adminId) throw new Error("Refusing to change the admin login");
    const member = owned.rows.find((item) => item.id === row.memberId);
    if (member.owner_user_id !== adminId && member.owner_user_id !== userId) {
      throw new Error("ID is owned by someone else");
    }
    await client.query(`update member_ids set owner_user_id = $2 where id = $1`, [row.memberId, userId]);
    await client.query(`update wallets set owner_user_id = $2 where member_id = $1`, [row.memberId, userId]);
    await client.query(`update wallet_transactions set owner_user_id = $2 where member_id = $1`, [row.memberId, userId]);
    await client.query(`update held_commissions set owner_user_id = $2 where member_id = $1`, [row.memberId, userId]);
    await client.query(
      `update membership_activation_events set owner_user_id = $2 where member_id = $1`,
      [row.memberId, userId],
    );
    await client.query(
      `update membership_activation_impacts set beneficiary_owner_user_id = $2 where beneficiary_id = $1`,
      [row.memberId, userId],
    );
    await client.query(
      `update sponsor_designation_credits set sponsor_owner_user_id = $2 where sponsor_id = $1`,
      [row.memberId, userId],
    );
    created.push({ name: row.name, email: row.email, memberId: row.memberId, code: row.code });
  }
  await client.query(
    `update app_users set active_id = null
     where user_id = $1 and active_id in ('LM-100001','LM-100002','LM-100003')`,
    [adminId],
  );
  const after = await client.query(
    `select password from "account" where "userId" = $1 and "providerId" = 'credential'`,
    [adminId],
  );
  if (after.rows[0]?.password !== adminHash) throw new Error("Admin password changed");
  await client.query("commit");

  for (const row of created) {
    const check = await client.query(
      `select a.password from "user" u
       join "account" a on a."userId" = u.id and a."providerId" = 'credential'
       where lower(u.email) = $1`,
      [row.email],
    );
    if (!(await verifyPassword(check.rows[0].password, password))) throw new Error("New password did not verify");
  }
  console.log(JSON.stringify({ ok: true, adminPasswordUnchanged: true, logins: created }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* no transaction */ }
  console.error(error instanceof Error ? error.message : "set failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
