/**
 * Read-only login check. Prints no password and no hash.
 *
 *   CONFIRM=CHECK-ADMIN-LOGIN CHECK_PASSWORD=... node scripts/check-admin-login.mjs
 */
import pg from "pg";
import { verifyPassword } from "@better-auth/utils/password";

const EMAIL = "linkmateglobal@gmail.com";
if (process.env.CONFIRM !== "CHECK-ADMIN-LOGIN") {
  console.error("Refusing: CONFIRM token missing");
  process.exit(1);
}
const password = process.env.CHECK_PASSWORD_B64
  ? Buffer.from(process.env.CHECK_PASSWORD_B64, "base64").toString("utf8")
  : "";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !password) {
  console.error("DATABASE_URL and CHECK_PASSWORD are required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  const users = await client.query(
    `select u.user_id, u.display_name, u.email, u.role, u.active_id
     from app_users u
     where lower(u.email) = $1
        or u.display_name ilike 'jabed%'
     order by u.created_at`,
    [EMAIL],
  );
  const authUsers = await client.query(
    `select id, name, email, "emailVerified"
     from "user"
     where lower(email) = $1 or name ilike 'jabed%'
     order by "createdAt"`,
    [EMAIL],
  );
  const accounts = [];
  for (const user of authUsers.rows) {
    const credential = await client.query(
      `select "password" is not null as has_password, "password" as hash
       from "account"
       where "userId" = $1 and "providerId" = 'credential'`,
      [user.id],
    );
    const hash = credential.rows[0]?.hash ?? null;
    let passwordMatches = false;
    if (hash) passwordMatches = await verifyPassword(hash, password);
    accounts.push({
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(credential.rows[0]?.has_password),
      passwordMatches,
    });
  }
  const members = await client.query(
    `select m.id, m.referral_code, m.sponsor_id, m.parent_id
     from member_ids m
     join app_users u on u.user_id = m.owner_user_id
     where lower(u.email) = $1
     order by m.created_at`,
    [EMAIL],
  );
  console.log(JSON.stringify({
    appAccounts: users.rows.map((row) => ({
      name: row.display_name,
      email: row.email,
      role: row.role,
      activeId: row.active_id,
    })),
    logins: accounts,
    memberIds: members.rows,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "check failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
