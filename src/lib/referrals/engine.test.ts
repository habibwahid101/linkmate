import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { authoritativeReferralCode, claimIntendedReferral, type Sql } from "./engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

function wrap(pg: PGlite): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql;
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
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0006_withdrawals.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0007_referral_lock_withdraw_fee.sql"), "utf8"));
  return wrap(pg);
}

describe("intended referral lock", () => {
  it("stores the first valid sponsor and ignores a later tampered code", async () => {
    const sql = await makeSql();
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('sponsor', 'Sponsor', 's@lm.test', 'member', 'SPON01', false),
             ('buyer', 'Buyer', 'b@lm.test', 'member', 'BUY001', false)
    `;
    const first = await claimIntendedReferral(sql, "buyer", "spon01");
    assert.equal(first.locked, true);
    assert.equal(first.referralCode, "SPON01");
    const second = await claimIntendedReferral(sql, "buyer", "OTHER1");
    assert.equal(second.referralCode, "SPON01");
    const auth = await authoritativeReferralCode(sql, "buyer", "HACK99");
    assert.equal(auth, "SPON01");
  });

  it("rejects self-referral and invalid codes", async () => {
    const sql = await makeSql();
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('buyer', 'Buyer', 'b@lm.test', 'member', 'BUY001', false)
    `;
    await assert.rejects(() => claimIntendedReferral(sql, "buyer", "BUY001"), /yourself/);
    await assert.rejects(() => claimIntendedReferral(sql, "buyer", "NOPE00"), /Invalid referral/);
  });
});
