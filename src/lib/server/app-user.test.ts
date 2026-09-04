import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { ensureAppUser, type AuthIdentity, type Sql } from "./app-user.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

function wrap(pg: PGlite): Sql {
  const run = async <T>(text: string, values: unknown[]) => {
    const result = await pg.query<T>(text, values);
    return result.rows;
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as Sql;
  return sql;
}

async function makeSql(): Promise<Sql> {
  if (lastPg) {
    try {
      await lastPg.close();
    } catch {
      /* ignore */
    }
    lastPg = undefined;
  }
  const pg = new PGlite();
  lastPg = pg;
  await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0001_auth.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  return wrap(pg);
}

async function insertAuth(sql: Sql, user: AuthIdentity) {
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    values (${user.id}, ${user.name ?? "Member"}, ${user.email ?? user.id + "@lm.test"}, false, now(), now())
  `;
}

describe("ensureAppUser", () => {
  it("creates app_users for a new auth identity as member", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "u1", name: "New Member", email: "new@lm.test" });
    const row = await ensureAppUser(sql, { id: "u1", name: "New Member", email: "new@lm.test" }, {
      allowBootstrapAdmin: false,
    });
    assert.equal(row.userId, "u1");
    assert.equal(row.role, "member");
    assert.equal(row.email, "new@lm.test");
    const count = await sql<{ n: number }>`select count(*)::int as n from app_users where user_id = ${"u1"}`;
    assert.equal(count[0]?.n, 1);
  });

  it("repairs a missing app_users row for an existing auth user", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "orphan", name: "Orphan", email: "orphan@lm.test" });
    const before = await sql<{ n: number }>`select count(*)::int as n from app_users`;
    assert.equal(before[0]?.n, 0);
    const row = await ensureAppUser(sql, { id: "orphan", email: "orphan@lm.test" }, { allowBootstrapAdmin: false });
    assert.equal(row.userId, "orphan");
    assert.equal(row.role, "member");
  });

  it("is idempotent and does not duplicate rows", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "u2", name: "Twice", email: "twice@lm.test" });
    const a = await ensureAppUser(sql, { id: "u2" }, { allowBootstrapAdmin: false });
    const b = await ensureAppUser(sql, { id: "u2" }, { allowBootstrapAdmin: false });
    assert.equal(a.referralCode, b.referralCode);
    const count = await sql<{ n: number }>`select count(*)::int as n from app_users where user_id = ${"u2"}`;
    assert.equal(count[0]?.n, 1);
  });

  it("concurrent bootstrap yields one row", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "race", name: "Race", email: "race@lm.test" });
    const results = await Promise.all([
      ensureAppUser(sql, { id: "race" }, { allowBootstrapAdmin: false }),
      ensureAppUser(sql, { id: "race" }, { allowBootstrapAdmin: false }),
      ensureAppUser(sql, { id: "race" }, { allowBootstrapAdmin: false }),
    ]);
    assert.equal(new Set(results.map((r) => r.userId)).size, 1);
    const count = await sql<{ n: number }>`select count(*)::int as n from app_users where user_id = ${"race"}`;
    assert.equal(count[0]?.n, 1);
  });

  it("does not downgrade an existing admin", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "adm", name: "Admin", email: "adm@lm.test" });
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('adm', 'Admin', 'adm@lm.test', 'admin', 'ADM001', false)
    `;
    const row = await ensureAppUser(sql, { id: "adm" }, { allowBootstrapAdmin: false });
    assert.equal(row.role, "admin");
  });

  it("preserves an existing member role", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "mem", name: "Mem", email: "mem@lm.test" });
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('mem', 'Mem', 'mem@lm.test', 'member', 'MEM001', false)
    `;
    const row = await ensureAppUser(sql, { id: "mem" }, { allowBootstrapAdmin: true });
    assert.equal(row.role, "member");
  });

  it("public signup cannot become admin when bootstrap is off", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "first", name: "First", email: "first@lm.test" });
    const row = await ensureAppUser(sql, { id: "first" }, { allowBootstrapAdmin: false });
    assert.equal(row.role, "member");
  });

  it("creates locked platform operators as admin", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "op2", name: "Link Mate", email: "linkmateglobal@gmail.com" });
    const row = await ensureAppUser(
      sql,
      { id: "op2", name: "Link Mate", email: "linkmateglobal@gmail.com" },
      { allowBootstrapAdmin: false },
    );
    assert.equal(row.role, "admin");
    const stored = await sql<{ role: string }>`select role from app_users where user_id = ${"op2"}`;
    assert.equal(stored[0]?.role, "admin");
  });

  it("restores a locked operator if the stored role was toggled to member", async () => {
    const sql = await makeSql();
    await insertAuth(sql, { id: "op2", name: "Link Mate", email: "linkmateglobal@gmail.com" });
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('op2', 'Link Mate', 'linkmateglobal@gmail.com', 'member', 'MQXSRC', false)
    `;
    const row = await ensureAppUser(sql, { id: "op2", email: "linkmateglobal@gmail.com" }, {
      allowBootstrapAdmin: false,
    });
    assert.equal(row.role, "admin");
    const stored = await sql<{ role: string }>`select role from app_users where user_id = ${"op2"}`;
    assert.equal(stored[0]?.role, "admin");
  });
});
