import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { PACKAGES, PACKAGE_IDS, type PackageId } from "@/lib/rules";
import { toInt } from "@/lib/money";
import { uid } from "@/lib/engine/ids";
import { createIdsForPurchase, attachExternalMember } from "@/lib/engine/process";
import { ensureProfileRow } from "@/lib/server/profile";

const packageIdSchema = z.enum(PACKAGE_IDS);

async function resolveActiveId(userId: string, preferred?: string | null) {
  const sql = await getSql();
  if (preferred) {
    const ok = await sql<{ id: string }>`
      select id from member_ids where id = ${preferred} and owner_user_id = ${userId}
    `;
    if (ok[0]) return ok[0].id;
  }
  const profile = await sql<{ active_id: string | null }>`
    select active_id from app_users where user_id = ${userId}
  `;
  if (profile[0]?.active_id) {
    const ok = await sql<{ id: string }>`
      select id from member_ids where id = ${profile[0].active_id} and owner_user_id = ${userId}
    `;
    if (ok[0]) return ok[0].id;
  }
  const first = await sql<{ id: string }>`
    select id from member_ids where owner_user_id = ${userId} order by created_at asc limit 1
  `;
  return first[0]?.id ?? null;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const activeId = await resolveActiveId(context.userId, profile.activeId);

    const ids = await sql<{
      id: string;
      package_id: string;
      is_root: boolean;
      sponsor_id: string | null;
      parent_id: string | null;
      placement_status: string;
      status: string;
      created_at: string;
    }>`
      select id, package_id, is_root, sponsor_id, parent_id, placement_status, status, created_at
      from member_ids where owner_user_id = ${context.userId}
      order by created_at asc
    `;

    const purchases = await sql<{
      id: string;
      package_id: string;
      amount_bdt: number;
      created_at: string;
    }>`
      select id, package_id, amount_bdt, created_at from package_purchases
      where user_id = ${context.userId} order by created_at desc
    `;

    const latestPackage = purchases[0]?.package_id ?? null;

    const walletAgg = await sql<{ available: number; released: number }>`
      select coalesce(sum(available_balance),0)::int as available,
             coalesce(sum(total_released),0)::int as released
      from wallets where owner_user_id = ${context.userId}
    `;
    const heldAgg = await sql<{ held: number }>`
      select coalesce(sum(amount),0)::int as held
      from held_commissions where owner_user_id = ${context.userId}
    `;

    let currentLevel = 0;
    let levelProgress: {
      level: number;
      generation: number;
      required_members: number;
      completed_members: number;
      remaining_members: number;
      accumulated_commission: number;
      expected_full_commission: number;
      status: string;
    }[] = [];
    let directSponsors = 0;
    let generationTotal = 0;
    let idWallet = { available: 0, held: 0, released: 0 };
    let activeMeta: (typeof ids)[number] | null = null;

    if (activeId) {
      activeMeta = ids.find((i) => i.id === activeId) ?? null;
      levelProgress = await sql`
        select level, generation, required_members, completed_members, remaining_members,
               accumulated_commission, expected_full_commission, status
        from level_progress where member_id = ${activeId} order by level
      `;
      const inPlay = [...levelProgress].reverse().find((l) => l.status === "IN_PROGRESS" || l.status === "ELIGIBLE");
      const released = [...levelProgress].reverse().find((l) => l.status === "RELEASED");
      currentLevel = inPlay?.level ?? released?.level ?? 1;

      const d = await sql<{ n: number }>`
        select count(*)::int as n from sponsor_relationships where sponsor_id = ${activeId}
      `;
      directSponsors = d[0]?.n ?? 0;
      const g = await sql<{ n: number }>`
        select count(*)::int as n from generation_memberships where beneficiary_id = ${activeId}
      `;
      generationTotal = g[0]?.n ?? 0;

      const w = await sql<{ available_balance: number; total_released: number }>`
        select available_balance, total_released from wallets where member_id = ${activeId}
      `;
      const h = await sql<{ held: number }>`
        select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${activeId}
      `;
      idWallet = {
        available: toInt(w[0]?.available_balance),
        released: toInt(w[0]?.total_released),
        held: toInt(h[0]?.held),
      };
    }

    const recentTx = await sql<{
      id: string;
      amount: number;
      source: string;
      level: number | null;
      generation: number | null;
      status: string;
      created_at: string;
      member_id: string;
    }>`
      select id, amount, source, level, generation, status, created_at, member_id
      from wallet_transactions where owner_user_id = ${context.userId}
      order by created_at desc limit 6
    `;

    const recentMembers = activeId
      ? await sql<{
          member_id: string;
          generation: number;
          display_name: string;
          package_id: string;
          created_at: string;
        }>`
          select gm.member_id, gm.generation, u.display_name, m.package_id, m.created_at
          from generation_memberships gm
          join member_ids m on m.id = gm.member_id
          join app_users u on u.user_id = m.owner_user_id
          where gm.beneficiary_id = ${activeId}
          order by m.created_at desc limit 6
        `
      : [];

    const unread = await sql<{ n: number }>`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;

    const next = levelProgress.find((l) => l.status === "IN_PROGRESS" || l.status === "ELIGIBLE")
      ?? levelProgress.find((l) => l.status === "LOCKED");

    return {
      profile,
      activeId,
      activeMeta,
      ids,
      latestPackage,
      currentLevel,
      directSponsors,
      generationTotal,
      wallet: {
        available: toInt(walletAgg[0]?.available),
        held: toInt(heldAgg[0]?.held),
        released: toInt(walletAgg[0]?.released),
      },
      idWallet,
      levelProgress,
      nextMilestone: next
        ? {
            level: next.level,
            remaining: next.remaining_members,
            required: next.required_members,
            completed: next.completed_members,
            nextRelease: next.expected_full_commission,
            status: next.status,
          }
        : null,
      recentTx,
      recentMembers,
      unread: unread[0]?.n ?? 0,
    };
  });

export const listMyIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    const rows = await sql<{
      id: string;
      package_id: string;
      sponsor_id: string | null;
      parent_id: string | null;
      placement_status: string;
      status: string;
      is_root: boolean;
      created_at: string;
    }>`
      select id, package_id, sponsor_id, parent_id, placement_status, status, is_root, created_at
      from member_ids where owner_user_id = ${context.userId} order by created_at asc
    `;
    if (rows.length === 0) return [];

    const wallets = await sql<{ member_id: string; available_balance: number; total_released: number }>`
      select member_id, available_balance, total_released from wallets where owner_user_id = ${context.userId}
    `;
    const heldRows = await sql<{ member_id: string; held: number }>`
      select member_id, coalesce(sum(amount),0)::int as held
      from held_commissions where owner_user_id = ${context.userId}
      group by member_id
    `;
    const progress = await sql<{ member_id: string; level: number; status: string }>`
      select lp.member_id, lp.level, lp.status
      from level_progress lp
      join member_ids m on m.id = lp.member_id
      where m.owner_user_id = ${context.userId}
    `;

    const walletBy = new Map(wallets.map((w) => [w.member_id, w]));
    const heldBy = new Map(heldRows.map((h) => [h.member_id, toInt(h.held)]));
    const inPlay = new Map<string, number>();
    const lastReleased = new Map<string, number>();
    for (const row of progress) {
      if (row.status === "IN_PROGRESS" || row.status === "ELIGIBLE") {
        const prev = inPlay.get(row.member_id);
        if (prev == null || row.level < prev) inPlay.set(row.member_id, row.level);
      }
      if (row.status === "RELEASED") {
        const prev = lastReleased.get(row.member_id) ?? 0;
        if (row.level > prev) lastReleased.set(row.member_id, row.level);
      }
    }

    return rows.map((row) => ({
      ...row,
      held: heldBy.get(row.id) ?? 0,
      available: toInt(walletBy.get(row.id)?.available_balance),
      released: toInt(walletBy.get(row.id)?.total_released),
      currentLevel: inPlay.get(row.id) ?? lastReleased.get(row.id) ?? 1,
    }));
  });

export const getTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ memberId: z.string().optional() }).optional())
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const activeId = await resolveActiveId(context.userId, data?.memberId ?? null);
    if (!activeId) {
      return { activeId: null, levels: [], members: [] as never[] };
    }
    const progress = await sql<{
      level: number;
      generation: number;
      required_members: number;
      completed_members: number;
      remaining_members: number;
      status: string;
    }>`
      select level, generation, required_members, completed_members, remaining_members, status
      from level_progress where member_id = ${activeId} order by level
    `;
    const members = await sql<{
      member_id: string;
      generation: number;
      display_name: string;
      package_id: string;
      created_at: string;
      status: string;
      sponsor_id: string | null;
      owner_user_id: string;
    }>`
      select gm.member_id, gm.generation, u.display_name, m.package_id, m.created_at,
             m.status, m.sponsor_id, m.owner_user_id
      from generation_memberships gm
      join member_ids m on m.id = gm.member_id
      join app_users u on u.user_id = m.owner_user_id
      where gm.beneficiary_id = ${activeId}
      order by gm.generation, m.created_at
    `;
    return { activeId, levels: progress, members };
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    const wallets = await sql<{
      member_id: string;
      available_balance: number;
      total_released: number;
    }>`select member_id, available_balance, total_released from wallets where owner_user_id = ${context.userId}`;
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
      wallets: wallets.map((w) => ({
        memberId: w.member_id,
        available: toInt(w.available_balance),
        released: toInt(w.total_released),
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
  .validator(z.object({ memberId: z.string().optional() }).optional())
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const activeId = await resolveActiveId(context.userId, data?.memberId ?? null);
    if (!activeId) return { activeId: null, levels: [] as never[] };
    const rows = await sql<{
      level: number;
      generation: number;
      required_members: number;
      completed_members: number;
      remaining_members: number;
      accumulated_commission: number;
      expected_full_commission: number;
      status: string;
      completed_at: string | null;
      released_at: string | null;
    }>`
      select level, generation, required_members, completed_members, remaining_members,
             accumulated_commission, expected_full_commission, status, completed_at, released_at
      from level_progress where member_id = ${activeId} order by level
    `;
    return { activeId, levels: rows };
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
    return withUserPurchaseLock(context.userId, async () => {
    const sql = await getSql();
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
      const byUser = await sql<{ user_id: string; active_id: string | null }>`
        select user_id, active_id from app_users where referral_code = ${code}
      `;
      if (byUser[0]) {
        sponsorMemberId = byUser[0].active_id;
        if (!sponsorMemberId) {
          const first = await sql<{ id: string }>`
            select id from member_ids where owner_user_id = ${byUser[0].user_id}
            order by created_at asc limit 1
          `;
          sponsorMemberId = first[0]?.id ?? null;
        }
      } else {
        const byId = await sql<{ id: string }>`
          select id from member_ids where id = ${code}
        `;
        sponsorMemberId = byId[0]?.id ?? null;
      }
      if (!sponsorMemberId) {
        throw new Error("Invalid referral code");
      }
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
    return withUserPurchaseLock(context.userId, async () => {
    const sql = await getSql();
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
    const sql = await getSql();
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
  .handler(async ({ context }) => {
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const activeId = await resolveActiveId(context.userId, profile.activeId);
    return {
      referralCode: profile.referralCode,
      activeId,
      displayName: profile.displayName,
    };
  });

export const getEarningsByLevel = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      level: number;
      generation: number;
      held: number;
      released: number;
    }>`
      select level, generation,
        coalesce(sum(case when status = 'HELD' then commission_amount else 0 end),0)::int as held,
        coalesce(sum(case when status = 'RELEASED' then commission_amount else 0 end),0)::int as released
      from commission_entries
      where beneficiary_user_id = ${context.userId}
      group by level, generation
      order by level
    `;
    return rows;
  });
