import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, advisoryLock, dbSource } from "@/lib/db";
import { runtimeFlags, PAYMENTS_DISABLED_MESSAGE, assertDurableMutations } from "@/lib/runtime";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { authMiddleware } from "@/lib/auth/middleware";
import { PACKAGES, PACKAGE_IDS } from "@/lib/rules";
import { toInt } from "@/lib/money";
import { uid } from "@/lib/engine/ids";
import { createIdsForPurchase, attachExternalMember } from "@/lib/engine/process";
import { ensureProfileRow } from "@/lib/server/profile";
import { resolveSponsorMember } from "@/lib/referrals/engine";
import {
  loadCompactIds,
  loadMembershipIdDetail,
  loadIdNetwork,
  loadInviteForId,
  resolveOwnedId,
  accountFromCompact,
} from "@/lib/server/id-views";
import { summarizeAccount } from "@/lib/id-workspace";

const packageIdSchema = z.enum(PACKAGE_IDS);
const optionalMemberId = z.object({ memberId: z.string().min(3).max(40).optional() }).optional();
const requiredMemberId = z.object({ memberId: z.string().min(3).max(40) });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const ids = await loadCompactIds(sql, context.userId);
    const summary = accountFromCompact(ids);

    const purchases = await sql<{
      id: string;
      package_id: string;
      amount_bdt: number;
      created_at: string;
    }>`
      select id, package_id, amount_bdt, created_at from package_purchases
      where user_id = ${context.userId} order by created_at desc
    `;

    const recentTx = await sql<{
      id: string;
      amount: number;
      source: string;
      level: number | null;
      status: string;
      created_at: string;
      member_id: string;
    }>`
      select id, amount, source, level, status, created_at, member_id
      from wallet_transactions where owner_user_id = ${context.userId}
      order by created_at desc limit 6
    `;

    const unread = await sql<{ n: number }>`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;

    return {
      profile,
      ids,
      latestPackage: purchases[0]?.package_id ?? null,
      wallet: {
        available: summary.available,
        held: summary.held,
        released: summary.released,
      },
      idCount: summary.idCount,
      highestActiveLevel: summary.highestActiveLevel,
      idsInProgress: summary.idsInProgress,
      graduatedCount: summary.graduatedCount,
      recentTx,
      unread: unread[0]?.n ?? 0,
      flags: runtimeFlags(),
    };
  });

export const listMyIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    return loadCompactIds(sql, context.userId);
  });

export const getMembershipIdDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(requiredMemberId)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return loadMembershipIdDetail(sql, context.userId, data.memberId);
  });

export const getTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(optionalMemberId)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const activeId = await resolveOwnedId(sql, context.userId, data?.memberId ?? null);
    if (!activeId) {
      return {
        activeId: null,
        levels: [],
        directs: [] as never[],
        members: [] as never[],
        hasMore: false,
        flags: runtimeFlags(),
      };
    }
    const network = await loadIdNetwork(sql, context.userId, activeId);
    return { ...network, flags: runtimeFlags() };
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    const ids = await loadCompactIds(sql, context.userId);
    const summary = summarizeAccount(ids);
    const held = await sql<{ member_id: string; level: number; amount: number }>`
      select member_id, level, amount from held_commissions
      where owner_user_id = ${context.userId} and amount > 0
    `;
    const tx = await sql<{
      id: string;
      member_id: string;
      type: string;
      amount: number;
      source: string;
      level: number | null;
      generation: number | null;
      related_member_id: string | null;
      status: string;
      created_at: string;
    }>`
      select id, member_id, type, amount, source, level, generation, related_member_id, status, created_at
      from wallet_transactions where owner_user_id = ${context.userId}
      order by created_at desc limit 100
    `;
    const entries = await sql<{
      id: string;
      beneficiary_id: string;
      source_id: string;
      generation: number;
      level: number;
      commission_amount: number;
      status: string;
      held_at: string;
      released_at: string | null;
    }>`
      select id, beneficiary_id, source_id, generation, level, commission_amount, status, held_at, released_at
      from commission_entries where beneficiary_user_id = ${context.userId}
      order by held_at desc limit 100
    `;
    return {
      summary,
      ids,
      wallets: ids.map((id) => ({
        memberId: id.id,
        available: id.available,
        released: id.released,
        held: id.held,
        currentLevel: id.current_level,
        packageId: id.package_id,
        progressionStatus: id.progression_status,
      })),
      held: held.map((h) => ({
        memberId: h.member_id,
        level: h.level,
        amount: toInt(h.amount),
      })),
      transactions: tx,
      commissions: entries,
    };
  });

export const getLevels = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(optionalMemberId)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const activeId = await resolveOwnedId(sql, context.userId, data?.memberId ?? null);
    if (!activeId) return { activeId: null, levels: [] as never[], meta: null };
    const detail = await loadMembershipIdDetail(sql, context.userId, activeId);
    return {
      activeId,
      levels: detail.journey,
      meta: {
        id: detail.id,
        currentLevel: detail.current_level,
        progressionStatus: detail.progression_status,
        packageId: detail.package_id,
        isRoot: detail.is_root,
        currentProgress: detail.currentProgress,
      },
    };
  });

const purchaseLocks = (globalThis as typeof globalThis & {
  __lmPurchaseLocks?: Map<string, Promise<unknown>>;
}).__lmPurchaseLocks ?? ((globalThis as typeof globalThis & { __lmPurchaseLocks?: Map<string, Promise<unknown>> }).__lmPurchaseLocks = new Map());

async function withUserPurchaseLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = purchaseLocks.get(userId);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  purchaseLocks.set(userId, gate);
  if (prev) await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (purchaseLocks.get(userId) === gate) purchaseLocks.delete(userId);
  }
}

export const purchasePackage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      packageId: packageIdSchema,
      referralCode: z.string().optional(),
      idempotencyKey: z.string().min(8).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    assertDurableMutations((key) => process.env[key], dbSource);
    const flags = runtimeFlags();
    if (flags.paymentsMode === "disabled") {
      throw new Error(PAYMENTS_DISABLED_MESSAGE);
    }
    const rootSql = await getSql();
    return rootSql.withTransaction(async (sql) => {
    await advisoryLock(sql, `purchase:${context.userId}`);
    await assertRateLimit(sql, `purchase:${context.userId}`, 8, 3600);
    await sql`
      create table if not exists purchase_idempotency (
        key text primary key,
        user_id text not null,
        purchase_id text not null,
        created_at timestamptz not null default now()
      )
    `;
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const pkg = PACKAGES[data.packageId];

    const existing = await sql<{ purchase_id: string }>`
      select purchase_id from purchase_idempotency
      where key = ${data.idempotencyKey} and user_id = ${context.userId}
    `;
    if (existing[0]) {
      const prior = await sql<{ id: string; root_id: string | null }>`
        select id, root_id from package_purchases where id = ${existing[0].purchase_id}
      `;
      const ids = await sql<{ id: string }>`
        select id from member_ids where purchase_id = ${existing[0].purchase_id} order by created_at
      `;
      return {
        purchaseId: existing[0].purchase_id,
        rootId: prior[0]?.root_id ?? ids[0]?.id ?? "",
        ids: ids.map((r) => r.id),
        replayed: true as const,
      };
    }
    let sponsorMemberId: string | null = null;
    const code = data.referralCode?.trim().toUpperCase();
    if (code) {
      const sponsor = await resolveSponsorMember(sql, code);
      if (!sponsor) throw new Error("Invalid referral code");
      sponsorMemberId = sponsor.memberId;
    }

    const purchaseId = uid();
    const paymentId = uid();

    const claimed = await sql<{ key: string }>`
      insert into purchase_idempotency (key, user_id, purchase_id)
      values (${data.idempotencyKey}, ${context.userId}, ${purchaseId})
      on conflict (key) do nothing
      returning key
    `;
    if (claimed.length === 0) {
      const existingKey = await sql<{ purchase_id: string }>`
        select purchase_id from purchase_idempotency
        where key = ${data.idempotencyKey} and user_id = ${context.userId}
      `;
      const prior = await sql<{ id: string; root_id: string | null }>`
        select id, root_id from package_purchases where id = ${existingKey[0]?.purchase_id ?? ""}
      `;
      const ids = await sql<{ id: string }>`
        select id from member_ids where purchase_id = ${existingKey[0]?.purchase_id ?? ""} order by created_at
      `;
      return {
        purchaseId: existingKey[0]?.purchase_id ?? "",
        rootId: prior[0]?.root_id ?? ids[0]?.id ?? "",
        ids: ids.map((r) => r.id),
        replayed: true as const,
      };
    }
    await sql`
      insert into package_purchases (
        id, user_id, package_id, amount_bdt, id_count, referral_code, sponsor_member_id, payment_status
      ) values (
        ${purchaseId}, ${context.userId}, ${pkg.id}, ${pkg.amountBdt}, ${pkg.idCount},
        ${code ?? null}, ${sponsorMemberId}, 'completed'
      )
    `;
    await sql`
      insert into payments (id, purchase_id, amount_bdt, method, status)
      values (${paymentId}, ${purchaseId}, ${pkg.amountBdt}, 'simulated', 'completed')
    `;
    await sql`
      insert into user_packages (id, user_id, package_id, purchase_id)
      values (${uid()}, ${context.userId}, ${pkg.id}, ${purchaseId})
    `;

    const created = await createIdsForPurchase(sql, {
      userId: context.userId,
      packageId: data.packageId,
      purchaseId,
      externalSponsorId: sponsorMemberId,
    });

    if (!profile.activeId) {
      await sql`update app_users set active_id = ${created.rootId} where user_id = ${context.userId}`;
    }

    await sql`
      insert into notifications (id, user_id, title, body, kind)
      values (
        ${uid()}, ${context.userId}, ${"Package purchase successful"},
        ${pkg.name + " is active. " + created.ids.length + " ID(s) issued. Root " + created.rootId + "."},
        'purchase'
      )
    `;
    await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (
        ${uid()}, ${context.userId}, 'package.purchase', 'package_purchases', ${purchaseId},
        ${pkg.id + " " + pkg.amountBdt}
      )
    `;

    return { purchaseId, rootId: created.rootId, ids: created.ids, replayed: false as const };
    });
  });

const SAMPLE_NAMES = [
  "Rafi Ahmed",
  "Nusrat Jahan",
  "Tanvir Hasan",
  "Farhana Akter",
  "Imran Hossain",
  "Sadia Rahman",
  "Mehedi Hasan",
  "Ayesha Siddique",
  "Shakib Khan",
  "Lamia Chowdhury",
  "Arif Rahman",
  "Nabila Islam",
];

export const loadSampleNetwork = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!runtimeFlags().demoNetwork) {
      throw new Error("Sample network is disabled in this environment");
    }
    return withUserPurchaseLock(context.userId, async () => {
    const sql = await getSql();
    await assertRateLimit(sql, `sample:${context.userId}`, 3, 3600);
    await ensureProfileRow(context.userId, "Member", null);
    const existing = await sql<{ n: number }>`
      select count(*)::int as n from member_ids where owner_user_id = ${context.userId}
    `;
    if ((existing[0]?.n ?? 0) > 0) {
      throw new Error("Sample data is only available on a fresh account");
    }

    const purchaseId = uid();
    await sql`
      insert into package_purchases (id, user_id, package_id, amount_bdt, id_count, payment_status)
      values (${purchaseId}, ${context.userId}, 'turbo', 44000, 4, 'completed')
    `;
    await sql`
      insert into payments (id, purchase_id, amount_bdt, method, status)
      values (${uid()}, ${purchaseId}, 44000, 'simulated', 'completed')
    `;
    await sql`
      insert into user_packages (id, user_id, package_id, purchase_id)
      values (${uid()}, ${context.userId}, 'turbo', ${purchaseId})
    `;

    const purchased = await createIdsForPurchase(sql, {
      userId: context.userId,
      packageId: "turbo",
      purchaseId,
      externalSponsorId: null,
    });

    const internals = purchased.ids.slice(1);
    // 6 gen-2 members: 2 under each of the 3 internal IDs → Level 2 = 6/9
    for (let i = 0; i < 6; i++) {
      const parent = internals[i % 3]!;
      const name = SAMPLE_NAMES[i]!;
      const synthId = `synth-${uid()}`;
      const code = `S${uid().replace(/-/g, "").slice(0, 10)}`;
      await sql`
        insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
        values (${synthId}, ${name}, ${null}, 'member', ${code}, true)
        on conflict (user_id) do nothing
      `;
      await attachExternalMember(sql, {
        ownerUserId: synthId,
        displayName: name,
        email: null,
        packageId: "builder",
        sponsorMemberId: parent,
        parentMemberId: parent,
      });
    }

    await sql`update app_users set active_id = ${purchased.rootId} where user_id = ${context.userId}`;
    return { rootId: purchased.rootId, ids: purchased.ids };
    });
  });

export const simulateDirectJoin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      sponsorMemberId: z.string(),
      name: z.string().min(2).max(80),
      packageId: packageIdSchema.optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!runtimeFlags().simulateJoins) {
      throw new Error("Simulated joins are disabled in this environment");
    }
    const sql = await getSql();
    await assertRateLimit(sql, `simulate:${context.userId}`, 20, 3600);
    const owned = await sql<{ id: string }>`
      select id from member_ids where id = ${data.sponsorMemberId} and owner_user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("You can only simulate joins under your own IDs");
    const synthId = `synth-${uid()}`;
    const code = `J${uid().replace(/-/g, "").slice(0, 10)}`;
    await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synthId}, ${data.name}, 'member', ${code}, true)
    `;
    const newId = await attachExternalMember(sql, {
      ownerUserId: synthId,
      displayName: data.name,
      email: null,
      packageId: data.packageId ?? "builder",
      sponsorMemberId: data.sponsorMemberId,
      parentMemberId: data.sponsorMemberId,
    });
    await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'join.simulate', 'member_ids', ${newId}, ${data.sponsorMemberId})
    `;
    return { memberId: newId };
  });

export const getInvite = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(optionalMemberId)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const ids = await loadCompactIds(sql, context.userId);
    if (ids.length === 0) {
      return {
        ids,
        selected: null as null,
        displayName: profile.displayName,
      };
    }
    const activeId = await resolveOwnedId(sql, context.userId, data?.memberId ?? null);
    const memberId = activeId ?? ids[0]!.id;
    const selected = await loadInviteForId(sql, context.userId, memberId);
    return { ids, selected, displayName: profile.displayName };
  });

export const getEarningsByLevel = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const ids = await loadCompactIds(sql, context.userId);
    const byLevel = await sql<{
      level: number;
      held: number;
      released: number;
    }>`
      select level,
        coalesce(sum(case when status = 'HELD' then commission_amount else 0 end),0)::int as held,
        coalesce(sum(case when status = 'RELEASED' then commission_amount else 0 end),0)::int as released
      from commission_entries
      where beneficiary_user_id = ${context.userId}
      group by level
      order by level
    `;
    const byId = await sql<{
      beneficiary_id: string;
      held: number;
      released: number;
    }>`
      select beneficiary_id,
        coalesce(sum(case when status = 'HELD' then commission_amount else 0 end),0)::int as held,
        coalesce(sum(case when status = 'RELEASED' then commission_amount else 0 end),0)::int as released
      from commission_entries
      where beneficiary_user_id = ${context.userId}
      group by beneficiary_id
    `;
    const byIdMap = new Map(byId.map((r) => [r.beneficiary_id, r]));
    return {
      summary: summarizeAccount(ids),
      byLevel,
      byId: ids.map((id) => ({
        memberId: id.id,
        packageId: id.package_id,
        currentLevel: id.current_level,
        progressionStatus: id.progression_status,
        held: toInt(byIdMap.get(id.id)?.held) || id.held,
        released: toInt(byIdMap.get(id.id)?.released) || id.released,
        available: id.available,
      })),
    };
  });
