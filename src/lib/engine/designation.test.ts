import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { attachExternalMember, createIdsForPurchase, reverseJoin } from "./process.ts";
import { wouldCreatePlacementCycle } from "./activation.ts";
import { countDesignationCredits, designationForCount, nextDesignation } from "./designations.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

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
    try { await lastPg.close(); } catch { /* ignore */ }
    lastPg = undefined;
  }
  const pg = new PGlite();
  lastPg = pg;
  await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0010_id_based_engine.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0012_sponsor_designations.sql"), "utf8"));
  return wrap(pg);
}

async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
}

test("designation thresholds are cumulative and display-only", () => {
  assert.equal(designationForCount(0), null);
  assert.equal(designationForCount(2), null);
  assert.equal(designationForCount(3)?.label, "Sales Executive");
  assert.equal(designationForCount(8)?.label, "Sales Executive");
  assert.equal(designationForCount(9)?.label, "Platinum Executive");
  assert.equal(designationForCount(17)?.label, "Platinum Executive");
  assert.equal(designationForCount(18)?.label, "Assistant Manager");
  assert.equal(designationForCount(34)?.label, "Assistant Manager");
  assert.equal(designationForCount(35)?.label, "Manager");
  assert.equal(designationForCount(86)?.label, "Manager");
  assert.equal(designationForCount(87)?.label, "General Manager");
  assert.equal(designationForCount(221)?.label, "General Manager");
  assert.equal(designationForCount(222)?.label, "Project Director");
  assert.equal(designationForCount(223)?.label, "Project Director");
  assert.equal(nextDesignation(3)?.label, "Platinum Executive");
  assert.equal(nextDesignation(222), null);
});

test("personal referral credit ignores package internals and survives inactivity", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-sponsor", "Sponsor");
  await insertUser(sql, "u-buyer", "Buyer");
  const sponsor = await createIdsForPurchase(sql, {
    userId: "u-sponsor",
    packageId: "builder",
    purchaseId: "p-sponsor",
    externalSponsorId: null,
  });
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-buyer",
    packageId: "turbo",
    purchaseId: "p-turbo",
    externalSponsorId: sponsor.rootId,
  });

  assert.equal(await countDesignationCredits(sql, sponsor.rootId), 1);
  assert.equal(await countDesignationCredits(sql, turbo.rootId), 0);
  const edges = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_relationships where sponsor_id = ${turbo.rootId}
  `;
  assert.equal(edges[0]?.n, 3);

  const held = await sql<{ n: number; amount: number }>`
    select count(*)::int as n, coalesce(sum(commission_amount), 0)::int as amount
    from commission_entries
    where beneficiary_id = ${sponsor.rootId} and status = 'HELD'
  `;
  assert.equal(held[0]?.n, 1);
  assert.equal(held[0]?.amount, 880);

  await sql`update member_ids set status = 'inactive' where id = ${turbo.rootId}`;
  assert.equal(await countDesignationCredits(sql, sponsor.rootId), 1);
});

test("three personal referrals reach Sales Executive; reversal voids only that credit", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-root", "Root");
  const root = await createIdsForPurchase(sql, {
    userId: "u-root",
    packageId: "builder",
    purchaseId: "p-root",
    externalSponsorId: null,
  });
  const ids: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await insertUser(sql, `u-d${i}`, `Direct ${i}`);
    ids.push(await attachExternalMember(sql, {
      ownerUserId: `u-d${i}`,
      displayName: `Direct ${i}`,
      email: null,
      packageId: "builder",
      sponsorMemberId: root.rootId,
      parentMemberId: root.rootId,
    }));
  }
  assert.equal(await countDesignationCredits(sql, root.rootId), 3);
  assert.equal(designationForCount(3)?.label, "Sales Executive");

  await reverseJoin(sql, { sourceId: ids[2]!, actorUserId: "u-root", reason: "mistaken activation" });
  assert.equal(await countDesignationCredits(sql, root.rootId), 2);
  const voided = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_designation_credits
    where sponsored_id = ${ids[2]} and voided_at is not null
  `;
  assert.equal(voided[0]?.n, 1);
  const level1 = await sql<{ completed_members: number }>`
    select completed_members from level_progress where member_id = ${root.rootId} and level = 1
  `;
  assert.equal(Number(level1[0]?.completed_members), 2);
});

test("placement parent cycle is rejected and does not create an ID", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-a", "A");
  await insertUser(sql, "u-b", "B");
  await insertUser(sql, "u-c", "C");
  const a = await createIdsForPurchase(sql, {
    userId: "u-a",
    packageId: "builder",
    purchaseId: "p-a",
    externalSponsorId: null,
  });
  const b = await attachExternalMember(sql, {
    ownerUserId: "u-b",
    displayName: "B",
    email: null,
    packageId: "builder",
    sponsorMemberId: a.rootId,
    parentMemberId: a.rootId,
  });
  await sql`update member_ids set parent_id = ${b} where id = ${a.rootId}`;
  assert.equal(await wouldCreatePlacementCycle(sql, "LM-new", a.rootId), true);
  const before = await sql<{ n: number }>`select count(*)::int as n from member_ids`;
  await assert.rejects(
    () => attachExternalMember(sql, {
      ownerUserId: "u-c",
      displayName: "C",
      email: null,
      packageId: "builder",
      sponsorMemberId: a.rootId,
      parentMemberId: a.rootId,
    }),
    /Placement cycle not allowed/,
  );
  const after = await sql<{ n: number }>`select count(*)::int as n from member_ids`;
  assert.equal(after[0]?.n, before[0]?.n);
});
