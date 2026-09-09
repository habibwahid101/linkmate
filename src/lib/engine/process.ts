import { STANDARD_ID_VALUE_BDT, type PackageId } from "../rules.ts";
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
  for (let i = 0; i < 8; i++) {
    const code = makeReferralCode(i === 0 ? seed : `${seed}:${i}:${uid()}`);
    const taken = await sql<{ n: number }>`
      select count(*)::int as n from member_ids where referral_code = ${code}
    `;
    if ((taken[0]?.n ?? 0) === 0) return code;
  }
  return makeReferralCode(uid());
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
  const referralCode = await uniqueReferralCode(sql, opts.id);
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
  await ensureWallet(sql, opts.id, opts.ownerUserId);
  await ensureLevelRows(sql, opts.id);
}

export async function createIdsForPurchase(
  sql: Sql,
  opts: {
    userId: string;
    packageId: PackageId;
    purchaseId: string;
    externalSponsorId: string | null;
  },
): Promise<{ rootId: string; ids: string[] }> {
  const plan = planPackagePlacement(opts.packageId);
  const codes: string[] = [];
  for (let i = 0; i < plan.length; i++) {
    codes.push(await nextMemberCode(sql));
  }

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
  }

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
