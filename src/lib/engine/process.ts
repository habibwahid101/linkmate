import { STANDARD_ID_VALUE_BDT, PACKAGES, type PackageId } from "../rules.ts";
import { planPackagePlacement } from "./placement.ts";
import { formatMemberId, makeReferralCode, uid } from "./ids.ts";
import {
  assertAcyclicSponsor,
  ensureLevelRows,
  ensureWallet,
  processMembershipIdActivation,
  processNewId,
  reconcileGenerationAncestry,
  reconcileWallet,
  reverseJoin,
  walkSponsorAncestry,
  type Sql,
} from "./activation.ts";

export {
  processMembershipIdActivation,
  processNewId,
  reconcileGenerationAncestry,
  reconcileWallet,
  reverseJoin,
  walkSponsorAncestry,
  ensureLevelRows,
  ensureWallet,
};
export type { SponsorHop, GenerationReconcileReport } from "./activation.ts";
export type { Sql };

type TxSql = Sql & { __inTx?: boolean };

/** Nested-safe transaction boundary. No-ops if already inside a transaction. */
export async function inTransaction<T>(sql: Sql, fn: (sql: Sql) => Promise<T>): Promise<T> {
  const s = sql as TxSql;
  if (s.__inTx) return fn(sql);
  if (typeof s.withTransaction === "function") {
    return s.withTransaction(async (tx) => {
      const inner = tx as TxSql;
      inner.__inTx = true;
      try {
        return await fn(inner);
      } finally {
        inner.__inTx = false;
      }
    });
  }
  return fn(sql);
}

async function nextMemberCode(sql: Sql): Promise<string> {
  const rows = await sql<{ n: number }>`select nextval('member_id_seq')::int as n`;
  return formatMemberId(rows[0]!.n);
}

async function notify(
  sql: Sql,
  userId: string,
  kind: string,
  title: string,
  body: string,
) {
  await sql`insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${userId}, ${title}, ${body}, ${kind})`;
}

async function uniqueReferralCode(sql: Sql, seed: string): Promise<string> {
  for (let i = 0; i < 16; i++) {
    const code = makeReferralCode(i === 0 ? seed : `${seed}:${i}:${uid()}`);
    const taken = await sql<{ n: number }>`
      select count(*)::int as n from member_ids where referral_code = ${code}
    `;
    if (Number(taken[0]?.n ?? 0) === 0) return code;
  }
  const raw = uid().replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 6; i++) {
    const n = parseInt(raw.slice(i * 5, i * 5 + 5), 16) || i;
    out += "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32]!;
  }
  return out;
}

async function insertMemberId(
  sql: Sql,
  opts: {
    id: string;
    ownerUserId: string;
    packageId: PackageId;
    purchaseId: string | null;
    isRoot: boolean;
    sponsorId: string | null;
    parentId: string | null;
    placementStatus: string;
    originKind: string;
  },
) {
  await assertAcyclicSponsor(sql, opts.id, opts.sponsorId);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const referralCode = await uniqueReferralCode(
      sql,
      attempt === 0 ? opts.id : `${opts.id}:${attempt}:${uid()}`,
    );
    try {
      await sql`
        insert into member_ids (
          id, owner_user_id, package_id, purchase_id, is_root, sponsor_id, parent_id,
          placement_status, status, joining_amount_bdt, referral_code, current_level,
          progression_status, activated_at, origin_kind
        ) values (
          ${opts.id}, ${opts.ownerUserId}, ${opts.packageId}, ${opts.purchaseId}, ${opts.isRoot},
          ${opts.sponsorId}, ${opts.parentId}, ${opts.placementStatus}, 'active', ${STANDARD_ID_VALUE_BDT},
          ${referralCode}, 1, 'ACTIVE', now(), ${opts.originKind}
        )
      `;
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/member_ids_referral_code_uq|duplicate key.*referral_code/i.test(msg)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Unable to allocate unique referral code");
}

export type CreateIdsOpts = {
  userId: string;
  packageId: PackageId;
  purchaseId: string;
  externalSponsorId: string | null;
  /** Test-only: throw after N member rows are inserted. */
  failAfterCreated?: number;
};

async function loadExistingPurchaseIds(sql: Sql, purchaseId: string) {
  return sql<{ id: string; is_root: boolean }>`
    select id, is_root from member_ids where purchase_id = ${purchaseId}
    order by created_at, id
  `;
}

async function orchestratePurchaseIds(
  sql: Sql,
  opts: CreateIdsOpts,
): Promise<{ rootId: string; ids: string[] }> {
  const expected = PACKAGES[opts.packageId].idCount;
  const existing = await loadExistingPurchaseIds(sql, opts.purchaseId);
  if (existing.length > 0) {
    if (existing.length !== expected) {
      throw new Error("Incomplete package ID set for this purchase");
    }
    const ids = existing.map((r) => r.id);
    const rootId = existing.find((r) => r.is_root)?.id ?? ids[0]!;
    for (const id of ids) await processNewId(sql, id);
    return { rootId, ids };
  }

  const plan = planPackagePlacement(opts.packageId);
  const codes: string[] = [];
  for (let i = 0; i < plan.length; i++) {
    codes.push(await nextMemberCode(sql));
  }

  // Parent-before-child inserts so every child sponsor/placement FK target exists.
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    const id = codes[i]!;
    const parentId = p.isRoot
      ? opts.externalSponsorId
      : p.parentIndex != null
        ? codes[p.parentIndex]!
        : null;
    const internalSponsor = p.sponsorIndex != null ? codes[p.sponsorIndex]! : null;
    const sponsorId = p.isRoot ? opts.externalSponsorId : internalSponsor;

    await insertMemberId(sql, {
      id,
      ownerUserId: opts.userId,
      packageId: opts.packageId,
      purchaseId: opts.purchaseId,
      isRoot: p.isRoot,
      sponsorId,
      parentId,
      placementStatus: p.placementStatus,
      originKind: p.isRoot ? "purchase_root" : "package_internal",
    });

    if (sponsorId) {
      await sql`
        insert into sponsor_relationships (id, sponsor_id, sponsored_id)
        values (${uid()}, ${sponsorId}, ${id})
        on conflict (sponsored_id) do nothing
      `;
    }
    if (parentId && p.placementStatus === "placed") {
      await sql`
        insert into placement_relationships (id, parent_id, child_id, position)
        values (${uid()}, ${parentId}, ${id}, ${p.position})
        on conflict (child_id) do nothing
      `;
    }
    if (opts.failAfterCreated != null && i + 1 >= opts.failAfterCreated) {
      throw new Error("PACKAGE_TEST_FAILURE");
    }
  }

  // Activate in the same parent-before-child order. Engine owns progress/commission.
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    if (p.placementStatus === "pending_config" && !p.isRoot && p.sponsorIndex == null && p.parentIndex == null) {
      continue;
    }
    await processNewId(sql, codes[i]!);
  }

  const rootId = codes[0]!;
  await sql`update package_purchases set root_id = ${rootId} where id = ${opts.purchaseId}`;

  await notify(
    sql,
    opts.userId,
    "ids",
    "New IDs created",
    `${codes.length} ID${codes.length === 1 ? "" : "s"} issued for your ${opts.packageId.replace("_", " ")} package. Root: ${rootId}.`,
  );

  return { rootId, ids: codes };
}

export async function createIdsForPurchase(
  sql: Sql,
  opts: CreateIdsOpts,
): Promise<{ rootId: string; ids: string[] }> {
  return inTransaction(sql, (tx) => orchestratePurchaseIds(tx, opts));
}

export async function attachExternalMember(
  sql: Sql,
  opts: {
    ownerUserId: string;
    displayName: string;
    email: string | null;
    packageId: PackageId;
    sponsorMemberId: string;
    parentMemberId: string;
  },
): Promise<string> {
  const newId = await nextMemberCode(sql);
  await insertMemberId(sql, {
    id: newId,
    ownerUserId: opts.ownerUserId,
    packageId: opts.packageId,
    purchaseId: null,
    isRoot: true,
    sponsorId: opts.sponsorMemberId,
    parentId: opts.parentMemberId,
    placementStatus: "placed",
    originKind: "attach",
  });
  await sql`
    insert into sponsor_relationships (id, sponsor_id, sponsored_id)
    values (${uid()}, ${opts.sponsorMemberId}, ${newId})
    on conflict (sponsored_id) do nothing
  `;
  await sql`
    insert into placement_relationships (id, parent_id, child_id, position)
    values (${uid()}, ${opts.parentMemberId}, ${newId}, 0)
    on conflict (child_id) do nothing
  `;
  await processNewId(sql, newId);
  return newId;
}
