import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { ensureAppUser, type Sql } from "./app-user.ts";
import { assertAdminRole } from "../auth/roles.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function wrap(pg: PGlite): Sql {
  const run = async <T>(text: string, values: unknown[]) => {
    const result = await pg.query<T>(text, values);
    return result.rows;
  };
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as Sql;
}

async function makeSql(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0001_auth.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  return wrap(pg);
}

describe("authenticated bootstrap", () => {
  it("creates a locked platform operator as admin", async () => {
    const sql = await makeSql();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values ('owner', 'Owner', 'hello.habibwahid@gmail.com', false, now(), now())
    `;
    const created = await ensureAppUser(sql, { id: "owner", email: "hello.habibwahid@gmail.com" }, {
      allowBootstrapAdmin: false,
    });
    assert.equal(created.role, "admin");
    const after = await ensureAppUser(sql, { id: "owner" }, { allowBootstrapAdmin: false });
    assert.equal(after.role, "admin");
    assertAdminRole(after.role);
  });

  it("empty membership queries return zeros instead of throwing", async () => {
    const sql = await makeSql();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values ('mem', 'Mem', 'mem@lm.test', false, now(), now())
    `;
    await ensureAppUser(sql, { id: "mem", email: "mem@lm.test" }, { allowBootstrapAdmin: false });
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids where owner_user_id = ${"mem"}`;
    const purchases = await sql<{ n: number }>`select count(*)::int as n from package_purchases where user_id = ${"mem"}`;
    const wallets = await sql<{ available: number }>`
      select coalesce(sum(available_balance),0)::int as available from wallets where owner_user_id = ${"mem"}
    `;
    const notes = await sql<{ n: number }>`select count(*)::int as n from notifications where user_id = ${"mem"}`;
    assert.equal(ids[0]?.n, 0);
    assert.equal(purchases[0]?.n, 0);
    assert.equal(wallets[0]?.available, 0);
    assert.equal(notes[0]?.n, 0);
  });

  it("member role is rejected by admin guard", async () => {
    let denied = false;
    try {
      assertAdminRole("member");
    } catch (error) {
      denied = error instanceof Error && error.message === "Forbidden";
    }
    assert.equal(denied, true);
  });
});
