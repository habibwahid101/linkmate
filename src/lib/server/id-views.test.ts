import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createIdsForPurchase } from "../engine/process.ts";
import { resolveSponsorMember } from "../referrals/engine.ts";
import {
  assertOwnedMemberId,
  loadCompactIds,
  loadInviteForId,
  loadMembershipIdDetail,
  type Sql,
} from "./id-views.ts";
import { MEMBERSHIP_ID_NOT_FOUND, summarizeAccount } from "../id-workspace.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

function wrap(pg: PGlite): Sql & { queries: string[] } {
  const queries: string[] = [];
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    queries.push(text);
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql & { queries: string[] };
  sql.queries = queries;
  return sql;
}

async function makeSql(): Promise<Sql & { queries: string[] }> {
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
  await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0005_manual_payments.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0010_id_based_engine.sql"), "utf8"));
  return wrap(pg);
}

async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, ${"member"}, ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
}

test("A. BUILDER owner compact + detail + referral", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-a", "Builder");
  const created = await createIdsForPurchase(sql, {
    userId: "u-a",
    packageId: "builder",
    purchaseId: "p-a",
    externalSponsorId: null,
  });
  const compact = await loadCompactIds(sql, "u-a");
  assert.equal(compact.length, 1);
  assert.equal(compact[0]!.id, created.rootId);
  assert.ok(compact[0]!.referral_code);
  assert.equal(compact[0]!.current_level, 1);
  assert.equal(compact[0]!.currentProgress.required, 3);
  const detail = await loadMembershipIdDetail(sql, "u-a", created.rootId);
  assert.equal(detail.journey.length, 9);
  assert.equal(detail.directs.required, 3);
  const invite = await loadInviteForId(sql, "u-a", created.rootId);
  assert.equal(invite.referralCode, compact[0]!.referral_code);
  assert.equal(invite.memberId, created.rootId);
});

test("B. TURBO 4 IDs independent referrals and progress", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-b", "Turbo");
  const created = await createIdsForPurchase(sql, {
    userId: "u-b",
    packageId: "turbo",
    purchaseId: "p-b",
    externalSponsorId: null,
  });
  assert.equal(created.ids.length, 4);
  const compact = await loadCompactIds(sql, "u-b");
  assert.equal(compact.length, 4);
  assert.equal(new Set(compact.map((r) => r.referral_code)).size, 4);
  const root = compact.find((r) => r.is_root)!;
  const internals = compact.filter((r) => !r.is_root);
  assert.equal(root.current_level >= 2 || root.currentProgress.status === "RELEASED" || root.directSponsors === 3, true);
  assert.ok(internals.every((r) => r.directSponsors === 0));
  const rootDetail = await loadMembershipIdDetail(sql, "u-b", root.id);
  const other = await loadMembershipIdDetail(sql, "u-b", internals[0]!.id);
  assert.notEqual(rootDetail.referral_code, other.referral_code);
  assert.notEqual(rootDetail.wallet.released, undefined);
});

test("C/D. SUPER and HYPER compact load never dumps generation_memberships", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "Super");
  await createIdsForPurchase(sql, {
    userId: "u-s",
    packageId: "super_turbo",
    purchaseId: "p-s",
    externalSponsorId: null,
  });
  sql.queries.length = 0;
  const superIds = await loadCompactIds(sql, "u-s");
  assert.equal(superIds.length, 13);
  assert.equal(sql.queries.some((q) => /generation_memberships/i.test(q)), false);

  await insertUser(sql, "u-h", "Hyper");
  await createIdsForPurchase(sql, {
    userId: "u-h",
    packageId: "hyper_turbo",
    purchaseId: "p-h",
    externalSponsorId: null,
  });
  sql.queries.length = 0;
  const hyperIds = await loadCompactIds(sql, "u-h");
  assert.equal(hyperIds.length, 22);
  assert.equal(sql.queries.some((q) => /generation_memberships/i.test(q)), false);
  assert.equal(new Set(hyperIds.map((r) => r.referral_code)).size, 22);
});

test("E. same owner different progress presents independently", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-e", "Owner");
  const a = await createIdsForPurchase(sql, { userId: "u-e", packageId: "builder", purchaseId: "p-e1", externalSponsorId: null });
  const b = await createIdsForPurchase(sql, { userId: "u-e", packageId: "builder", purchaseId: "p-e2", externalSponsorId: a.rootId });
  await sql`update member_ids set current_level = 2 where id = ${b.rootId}`;
  await sql`update member_ids set current_level = 4, progression_status = 'ACTIVE' where id = ${a.rootId}`;
  const extra = await createIdsForPurchase(sql, { userId: "u-e", packageId: "builder", purchaseId: "p-e3", externalSponsorId: null });
  await sql`update member_ids set current_level = 9, progression_status = 'GRADUATED' where id = ${extra.rootId}`;
  const compact = await loadCompactIds(sql, "u-e");
  const byId = new Map(compact.map((r) => [r.id, r]));
  assert.equal(byId.get(b.rootId)?.current_level, 2);
  assert.equal(byId.get(a.rootId)?.current_level, 4);
  assert.equal(byId.get(extra.rootId)?.progression_status, "GRADUATED");
  const graduated = await loadMembershipIdDetail(sql, "u-e", extra.rootId);
  assert.equal(graduated.progression_status, "GRADUATED");
  assert.equal(graduated.currentProgress.level, 9);
});

test("F. earnings stay attributed per ID", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-f", "Earn");
  const first = await createIdsForPurchase(sql, { userId: "u-f", packageId: "builder", purchaseId: "p-f1", externalSponsorId: null });
  const turbo = await createIdsForPurchase(sql, { userId: "u-f", packageId: "turbo", purchaseId: "p-f2", externalSponsorId: first.rootId });
  const compact = await loadCompactIds(sql, "u-f");
  const builder = compact.find((r) => r.id === first.rootId)!;
  const turboRoot = compact.find((r) => r.id === turbo.rootId)!;
  assert.equal(builder.held, 880);
  assert.equal(turboRoot.released, 2640);
  assert.notEqual(builder.held, turboRoot.held);
  const sum = summarizeAccount(compact);
  assert.equal(sum.held + sum.released, builder.held + builder.released + turboRoot.held + turboRoot.released + compact.filter((r) => r.id !== builder.id && r.id !== turboRoot.id).reduce((s, r) => s + r.held + r.released, 0));
});

test("G. referral resolves to exact Membership ID", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-g", "Ref");
  const created = await createIdsForPurchase(sql, { userId: "u-g", packageId: "turbo", purchaseId: "p-g", externalSponsorId: null });
  const compact = await loadCompactIds(sql, "u-g");
  for (const row of compact) {
    const resolved = await resolveSponsorMember(sql, row.referral_code!);
    assert.equal(resolved?.memberId, row.id);
    const invite = await loadInviteForId(sql, "u-g", row.id);
    assert.equal(invite.referralCode, row.referral_code);
  }
  const byId = await resolveSponsorMember(sql, created.rootId);
  assert.equal(byId?.memberId, created.rootId);
});

test("H. ownership fail-closed", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-ha", "A");
  await insertUser(sql, "u-hb", "B");
  const a = await createIdsForPurchase(sql, { userId: "u-ha", packageId: "builder", purchaseId: "p-ha", externalSponsorId: null });
  await createIdsForPurchase(sql, { userId: "u-hb", packageId: "builder", purchaseId: "p-hb", externalSponsorId: null });
  await assert.rejects(() => loadMembershipIdDetail(sql, "u-hb", a.rootId), new RegExp(MEMBERSHIP_ID_NOT_FOUND));
  await assert.rejects(() => assertOwnedMemberId(sql, "u-hb", a.rootId), new RegExp(MEMBERSHIP_ID_NOT_FOUND));
  await assert.rejects(() => loadInviteForId(sql, "u-hb", a.rootId), new RegExp(MEMBERSHIP_ID_NOT_FOUND));
});

test("I. empty account compact list", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-i", "Empty");
  const compact = await loadCompactIds(sql, "u-i");
  assert.equal(compact.length, 0);
});
