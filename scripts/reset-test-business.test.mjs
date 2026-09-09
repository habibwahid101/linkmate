import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { applyReset, inventory, KEEP_ADMIN_EMAILS } from "./reset-test-business.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function wrap(pg) {
  return {
    query: async (text, params = []) => {
      const result = await pg.query(text, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
}

async function makeClient() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const file of [
    "migrations/0001_auth.sql",
    "migrations/0002_schema.sql",
    "migrations/0003_hardening.sql",
    "migrations/0004_production.sql",
    "migrations/0005_manual_payments.sql",
    "migrations/0006_withdrawals.sql",
    "migrations/0007_referral_lock_withdraw_fee.sql",
    "migrations/0008_owner_payout_policy.sql",
    "migrations/0009_owner_locked_decisions.sql",
  ]) {
    await pg.exec(readFileSync(join(ROOT, file), "utf8"));
  }
  return { pg, client: wrap(pg) };
}

describe("reset-test-business", () => {
  it("keeps two admins and wipes disposable member/business rows", async () => {
    const { client } = await makeClient();
    await client.query(
      `insert into "user" ("id","name","email","emailVerified","createdAt","updatedAt") values
       ('a1','Owner','hello.habibwahid@gmail.com',true,now(),now()),
       ('a2','Link Mate','linkmateglobal@gmail.com',true,now(),now()),
       ('m1','Test Member','qa.member@lm.test',true,now(),now())`,
    );
    await client.query(
      `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
       values
       ('a1','Owner','hello.habibwahid@gmail.com','admin','AAAAAA',false),
       ('a2','Link Mate','linkmateglobal@gmail.com','admin','BBBBBB',false),
       ('m1','Test Member','qa.member@lm.test','member','CCCCCC',true)`,
    );
    await client.query(
      `insert into member_ids (id, owner_user_id, package_id, is_root, joining_amount_bdt)
       values ('LM-100001','m1','builder',true,11000)`,
    );
    await client.query(
      `insert into package_purchases (id, user_id, package_id, amount_bdt, id_count)
       values ('p1','m1','builder',11000,1)`,
    );
    await client.query(
      `insert into wallets (member_id, owner_user_id, available_balance, total_released)
       values ('LM-100001','m1',500,500)`,
    );
    await client.query(
      `update app_users set active_id = 'LM-100001' where user_id = 'a1'`,
    );

    const before = await inventory(client);
    assert.equal(before.admin_count, 2);
    assert.equal(before.non_admin_users, 1);
    assert.equal(before.tables.member_ids, 1);
    assert.equal(before.gate, "PASS");

    const deleted = await applyReset(client, before, { CONFIRM: "LINKMATE-RESET-TEST-BUSINESS" });
    assert.equal(deleted.member_ids, 1);
    assert.equal(deleted.dropped_non_admin_users, 1);

    const after = await inventory(client);
    assert.equal(after.admin_count, 2);
    assert.deepEqual(
      after.admins.map((a) => a.email).sort(),
      [...KEEP_ADMIN_EMAILS].sort(),
    );
    assert.equal(after.non_admin_users, 0);
    assert.equal(after.tables.member_ids, 0);
    assert.equal(after.tables.package_purchases, 0);
    assert.equal(after.tables.wallets, 0);
    assert.equal(after.tables.packages, 4);
    assert.equal(after.tables.commission_rules, 9);
    const leftoverUsers = await client.query(`select count(*)::int as n from "user"`);
    assert.equal(leftoverUsers.rows[0].n, 2);
    const active = await client.query(`select active_id from app_users where user_id = 'a1'`);
    assert.equal(active.rows[0].active_id, null);
  });

  it("refuses to apply without the confirm token", async () => {
    const { client } = await makeClient();
    await client.query(
      `insert into "user" ("id","name","email","emailVerified","createdAt","updatedAt") values
       ('a1','Owner','hello.habibwahid@gmail.com',true,now(),now()),
       ('a2','Link Mate','linkmateglobal@gmail.com',true,now(),now())`,
    );
    await client.query(
      `insert into app_users (user_id, display_name, email, role, referral_code)
       values
       ('a1','Owner','hello.habibwahid@gmail.com','admin','AAAAAA'),
       ('a2','Link Mate','linkmateglobal@gmail.com','admin','BBBBBB')`,
    );
    const inv = await inventory(client);
    await assert.rejects(() => applyReset(client, inv, {}), /CONFIRM=/);
  });
});
