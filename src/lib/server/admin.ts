import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureProfileRow } from "@/lib/server/profile";
import { toInt } from "@/lib/money";
import { uid } from "@/lib/engine/ids";
import { LEVELS } from "@/lib/rules";
import { reverseJoin, reconcileWallet } from "@/lib/engine/process";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertAdminRole } from "@/lib/auth/roles";
import { assertCanDemoteAdmin, isLockedAdminEmail } from "@/lib/auth/locked-admins";
import {
  loadCompactIds,
  type DirectSponsored,
  type IdActivityTx,
  type IdCommission,
  type LevelJourneyRow,
} from "@/lib/server/id-views";
import { buildCurrentProgress, ID_DETAIL_DIRECT_CAP, ID_DETAIL_TX_CAP, summarizeAccount } from "@/lib/id-workspace";
import { evaluateLandQualification } from "@/lib/qualification";

export { assertAdminRole };

export async function requireAdmin(userId: string) {
  const profile = await ensureProfileRow(userId, "Member", null);
  assertAdminRole(profile.role);
  return profile;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();

    const users = await sql<{ n: number }>`select count(*)::int as n from app_users where is_synthetic = false`;
    const allUsers = await sql<{ n: number }>`select count(*)::int as n from app_users`;
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids where status = 'active'`;
    const dist = await sql<{ package_id: string; n: number; value: number }>`
      select package_id, count(*)::int as n, coalesce(sum(amount_bdt),0)::int as value
      from package_purchases group by package_id
    `;
    const joining = await sql<{ v: number }>`select coalesce(sum(amount_bdt),0)::int as v from package_purchases`;
    const held = await sql<{ v: number }>`select coalesce(sum(amount),0)::int as v from held_commissions`;
    const released = await sql<{ v: number }>`select coalesce(sum(total_released),0)::int as v from wallets`;
    const available = await sql<{ v: number }>`select coalesce(sum(available_balance),0)::int as v from wallets`;
    const reversed = await sql<{ v: number }>`
      select coalesce(sum(commission_amount),0)::int as v from commission_entries where status = 'REVERSED'
    `;
    const completions = await sql<{ level: number; n: number }>`
      select level, count(*)::int as n from level_progress
      where status in ('COMPLETED','RELEASED') group by level order by level
    `;
    const recentPurchases = await sql<{
      id: string;
      user_id: string;
      package_id: string;
      amount_bdt: number;
      created_at: string;
    }>`
      select id, user_id, package_id, amount_bdt, created_at
      from package_purchases order by created_at desc limit 8
    `;

    const byPkg: Record<string, { count: number; value: number }> = {
      builder: { count: 0, value: 0 },
      turbo: { count: 0, value: 0 },
      super_turbo: { count: 0, value: 0 },
      hyper_turbo: { count: 0, value: 0 },
    };
    for (const row of dist) {
      byPkg[row.package_id] = { count: row.n, value: toInt(row.value) };
    }

    const pendingPayments = await sql<{ n: number }>`
      select count(*)::int as n from payment_requests where status = 'PENDING'
    `;
    const needsReviewPayments = await sql<{ n: number }>`
      select count(*)::int as n from payment_requests where status = 'NEEDS_REVIEW'
    `;
    const pendingWithdrawals = await sql<{ n: number }>`
      select count(*)::int as n from withdrawal_requests
      where status in ('PENDING', 'APPROVED', 'PROCESSING')
    `;
    const qualifiedLand = await sql<{ n: number }>`
      select count(*)::int as n
      from member_ids m
      where m.status = 'active'
        and exists (
          select 1 from level_progress lp
          where lp.member_id = m.id and lp.level = 9 and lp.status in ('COMPLETED','RELEASED')
        )
        and (select count(*) from sponsor_relationships sr where sr.sponsor_id = m.id) >= ${LEVELS[0]!.requiredMembers}
    `;
    const recentAudit = await sql<{
      id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }>`
      select id, action, entity_type, entity_id, created_at
      from audit_logs order by created_at desc limit 8
    `;

    return {
      totalUsers: users[0]?.n ?? 0,
      totalAccounts: allUsers[0]?.n ?? 0,
      activeIds: ids[0]?.n ?? 0,
      packages: byPkg,
      joiningValue: toInt(joining[0]?.v),
      held: toInt(held[0]?.v),
      released: toInt(released[0]?.v),
      available: toInt(available[0]?.v),
      walletLiabilities: toInt(available[0]?.v),
      reversed: toInt(reversed[0]?.v),
      pendingPayments: pendingPayments[0]?.n ?? 0,
      needsReviewPayments: needsReviewPayments[0]?.n ?? 0,
      pendingWithdrawals: pendingWithdrawals[0]?.n ?? 0,
      qualifiedLand: qualifiedLand[0]?.n ?? 0,
      completions,
      recentPurchases,
      recentAudit,
      levels: LEVELS,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return (
      await sql<{
        user_id: string;
        display_name: string;
        email: string | null;
        role: string;
        referral_code: string;
        is_synthetic: boolean;
        created_at: string;
        id_count: number;
      }>`
      select u.user_id, u.display_name, u.email, u.role, u.referral_code, u.is_synthetic, u.created_at,
             (select count(*)::int from member_ids m where m.owner_user_id = u.user_id) as id_count
      from app_users u
      order by u.created_at desc
      limit 200
    `
    ).map((u) => ({ ...u, locked: isLockedAdminEmail(u.email) }));
  });

export const adminGetUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const users = await sql<{
      user_id: string;
      display_name: string;
      email: string | null;
      role: string;
      referral_code: string;
      is_synthetic: boolean;
      created_at: string;
      active_id: string | null;
    }>`
      select user_id, display_name, email, role, referral_code, is_synthetic, created_at, active_id
      from app_users where user_id = ${data.userId}
    `;
    const user = users[0];
    if (!user) throw new Error("Account not found");
    const ids = await loadCompactIds(sql, data.userId);
    const purchases = await sql<{
      id: string;
      package_id: string;
      amount_bdt: number;
      id_count: number;
      root_id: string | null;
      payment_status: string;
      created_at: string;
    }>`
      select id, package_id, amount_bdt, id_count, root_id, payment_status, created_at
      from package_purchases where user_id = ${data.userId}
      order by created_at desc limit 20
    `;
    const payments = await sql<{
      id: string;
      package_id: string;
      expected_amount_bdt: number;
      payment_method: string;
      status: string;
      created_at: string;
    }>`
      select id, package_id, expected_amount_bdt, payment_method, status, created_at
      from payment_requests where user_id = ${data.userId}
      order by created_at desc limit 20
    `;
    const wallets = await sql<{ available: number; released: number }>`
      select coalesce(sum(available_balance),0)::int as available,
             coalesce(sum(total_released),0)::int as released
      from wallets where owner_user_id = ${data.userId}
    `;
    const held = await sql<{ v: number }>`
      select coalesce(sum(amount),0)::int as v from held_commissions where owner_user_id = ${data.userId}
    `;
    return {
      user: { ...user, locked: isLockedAdminEmail(user.email) },
      ids,
      account: summarizeAccount(ids),
      wallet: {
        available: toInt(wallets[0]?.available),
        released: toInt(wallets[0]?.released),
        held: toInt(held[0]?.v),
      },
      purchases,
      payments,
    };
  });

export const adminListIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      owner_user_id: string;
      display_name: string;
      package_id: string;
      sponsor_id: string | null;
      parent_id: string | null;
      placement_status: string;
      status: string;
      referral_code: string | null;
      current_level: number | null;
      progression_status: string | null;
      created_at: string;
    }>`
      select m.id, m.owner_user_id, u.display_name, m.package_id, m.sponsor_id, m.parent_id,
             m.placement_status, m.status, m.referral_code, m.current_level, m.progression_status, m.created_at
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      order by m.created_at desc
      limit 300
    `;
  });

export const adminGetMemberId = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ memberId: z.string().min(1).max(40) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      owner_user_id: string;
      display_name: string;
      email: string | null;
      package_id: string;
      is_root: boolean;
      origin_kind: string | null;
      sponsor_id: string | null;
      parent_id: string | null;
      placement_status: string;
      status: string;
      current_level: number | null;
      progression_status: string | null;
      referral_code: string | null;
      created_at: string;
    }>`
      select m.id, m.owner_user_id, u.display_name, u.email, m.package_id, m.is_root, m.origin_kind,
             m.sponsor_id, m.parent_id, m.placement_status, m.status, m.current_level, m.progression_status,
             m.referral_code, m.created_at
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      where m.id = ${data.memberId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Membership ID not found");

    const journey = await sql<LevelJourneyRow>`
      select level, generation, required_members, completed_members, remaining_members,
             accumulated_commission, expected_full_commission, status, completed_at, released_at
      from level_progress where member_id = ${data.memberId} order by level
    `;
    const directCount = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships where sponsor_id = ${data.memberId}
    `;
    const directs = await sql<DirectSponsored>`
      select m.id as member_id, u.display_name, m.package_id, m.created_at, m.status, m.owner_user_id
      from sponsor_relationships sr
      join member_ids m on m.id = sr.sponsored_id
      join app_users u on u.user_id = m.owner_user_id
      where sr.sponsor_id = ${data.memberId}
      order by m.created_at
      limit ${ID_DETAIL_DIRECT_CAP}
    `;
    const network = await sql<{ downline_ids: number; network_depth: number }>`
      select count(*)::int as downline_ids, coalesce(max(generation),0)::int as network_depth
      from generation_memberships where beneficiary_id = ${data.memberId}
    `;
    const w = await sql<{ available_balance: number; total_released: number }>`
      select available_balance, total_released from wallets where member_id = ${data.memberId}
    `;
    const h = await sql<{ held: number }>`
      select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${data.memberId}
    `;
    const recentTx = await sql<IdActivityTx>`
      select id, amount, source, type, level, status, created_at, related_member_id
      from wallet_transactions where member_id = ${data.memberId}
      order by created_at desc limit ${ID_DETAIL_TX_CAP}
    `;
    const commissions = await sql<IdCommission>`
      select id, source_id, level, commission_amount, status, held_at, released_at
      from commission_entries where beneficiary_id = ${data.memberId}
      order by held_at desc limit ${ID_DETAIL_TX_CAP}
    `;

    const currentLevel = Number(row.current_level) || 1;
    const progressionStatus = row.progression_status === "GRADUATED" ? "GRADUATED" : "ACTIVE";
    const completedLevels = journey.filter((p) => p.status === "RELEASED" || p.status === "COMPLETED").length;
    const level9Released = journey.some((p) => p.level === 9 && (p.status === "RELEASED" || p.status === "COMPLETED"));
    const directsN = directCount[0]?.n ?? 0;
    const qualification = evaluateLandQualification({
      hasMembership: row.status === "active",
      directSponsors: directsN,
      completedLevels,
      level9Released,
    });
    const currentProgress = buildCurrentProgress({
      currentLevel,
      progressionStatus,
      progressRows: journey.map((p) => ({
        level: p.level,
        status: p.status,
        completed: toInt(p.completed_members),
        required: toInt(p.required_members),
        remaining: toInt(p.remaining_members),
      })),
    });

    return {
      id: row.id,
      owner: {
        userId: row.owner_user_id,
        displayName: row.display_name,
        email: row.email,
      },
      package_id: row.package_id,
      is_root: Boolean(row.is_root),
      origin_kind: row.origin_kind ?? "purchase",
      sponsor_id: row.sponsor_id,
      parent_id: row.parent_id,
      placement_status: row.placement_status,
      status: row.status,
      current_level: currentLevel,
      progression_status: progressionStatus,
      referral_code: row.referral_code,
      created_at: row.created_at,
      currentProgress,
      journey,
      directs: {
        count: directsN,
        required: LEVELS[0]!.requiredMembers,
        members: directs,
        hasMore: directsN > directs.length,
      },
      network: {
        directIds: directsN,
        downlineIds: network[0]?.downline_ids ?? 0,
        networkDepth: network[0]?.network_depth ?? 0,
      },
      wallet: {
        held: toInt(h[0]?.held),
        available: toInt(w[0]?.available_balance),
        released: toInt(w[0]?.total_released),
      },
      qualification,
      recentTx,
      commissions,
    };
  });

export const adminListQualification = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      owner_user_id: string;
      display_name: string;
      package_id: string;
      status: string;
      directs: number;
      completed_levels: number;
      level9: boolean;
    }>`
      select m.id, m.owner_user_id, u.display_name, m.package_id, m.status,
             (select count(*)::int from sponsor_relationships sr where sr.sponsor_id = m.id) as directs,
             (select count(*)::int from level_progress lp
                where lp.member_id = m.id and lp.status in ('COMPLETED','RELEASED')) as completed_levels,
             exists (
               select 1 from level_progress lp
               where lp.member_id = m.id and lp.level = 9 and lp.status in ('COMPLETED','RELEASED')
             ) as level9
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      order by m.created_at desc
      limit 200
    `;
    return rows.map((row) => {
      const qualification = evaluateLandQualification({
        hasMembership: row.status === "active",
        directSponsors: row.directs,
        completedLevels: row.completed_levels,
        level9Released: Boolean(row.level9),
      });
      return {
        id: row.id,
        owner_user_id: row.owner_user_id,
        display_name: row.display_name,
        package_id: row.package_id,
        membershipStatus: row.status,
        ...qualification,
      };
    });
  });

export const adminListPurchases = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      user_id: string;
      display_name: string;
      package_id: string;
      amount_bdt: number;
      id_count: number;
      root_id: string | null;
      payment_status: string;
      created_at: string;
    }>`
      select p.id, p.user_id, u.display_name, p.package_id, p.amount_bdt, p.id_count,
             p.root_id, p.payment_status, p.created_at
      from package_purchases p
      join app_users u on u.user_id = p.user_id
      order by p.created_at desc
      limit 200
    `;
  });

export const adminListCommissions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ status: z.string().optional() }).optional())
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    if (data?.status) {
      return sql<{
        id: string;
        beneficiary_id: string;
        source_id: string;
        level: number;
        generation: number;
        commission_amount: number;
        status: string;
        held_at: string;
        released_at: string | null;
      }>`
        select id, beneficiary_id, source_id, level, generation, commission_amount, status, held_at, released_at
        from commission_entries where status = ${data.status}
        order by held_at desc limit 300
      `;
    }
    return sql<{
      id: string;
      beneficiary_id: string;
      source_id: string;
      level: number;
      generation: number;
      commission_amount: number;
      status: string;
      held_at: string;
      released_at: string | null;
    }>`
      select id, beneficiary_id, source_id, level, generation, commission_amount, status, held_at, released_at
      from commission_entries
      order by held_at desc limit 300
    `;
  });

export const adminListWallets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      member_id: string;
      owner_user_id: string;
      display_name: string;
      available_balance: number;
      total_released: number;
      held: number;
    }>`
      select w.member_id, w.owner_user_id, u.display_name, w.available_balance, w.total_released,
             coalesce((select sum(amount) from held_commissions h where h.member_id = w.member_id),0)::int as held
      from wallets w
      join app_users u on u.user_id = w.owner_user_id
      order by w.available_balance desc
      limit 300
    `;
  });

export const adminListTransactions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      member_id: string;
      owner_user_id: string;
      type: string;
      amount: number;
      source: string;
      level: number | null;
      status: string;
      created_at: string;
    }>`
      select id, member_id, owner_user_id, type, amount, source, level, status, created_at
      from wallet_transactions order by created_at desc limit 300
    `;
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      actor_user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      detail: string | null;
      created_at: string;
    }>`
      select id, actor_user_id, action, entity_type, entity_id, detail, created_at
      from audit_logs order by created_at desc limit 200
    `;
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const settings = await sql<{ key: string; value: string; updated_at: string }>`
      select key, value, updated_at from app_settings order by key
    `;
    const packages = await sql<{
      id: string;
      name: string;
      amount_bdt: number;
      id_count: number;
      placement_rule_version: string;
      active: boolean;
      locked: boolean;
    }>`select id, name, amount_bdt, id_count, placement_rule_version, active, locked from packages order by amount_bdt`;
    const rules = await sql<{
      level: number;
      generation: number;
      generation_label: string;
      required_member_count: number;
      rate: string;
      status: string;
      version: number;
    }>`select level, generation, generation_label, required_member_count, rate::text, status, version from commission_rules order by level`;
    return { settings, packages, rules };
  });

export const adminUpdateSetting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ key: z.string().min(1).max(80), value: z.string().max(200), confirm: z.literal(true) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await assertRateLimit(sql, `admin:settings:${context.userId}`, 20, 3600);
    const lockedKeys = [
      "standard_id_value_bdt",
      "rule_version",
      "bootstrap_admin",
      "hyper_turbo_placement_version",
    ];
    if (lockedKeys.includes(data.key)) {
      throw new Error("This setting is locked");
    }
    const existing = await sql<{ key: string }>`select key from app_settings where key = ${data.key}`;
    if (!existing[0]) throw new Error("Unknown setting");
    await sql`
      update app_settings
      set value = ${data.value}, updated_by = ${context.userId}, updated_at = now()
      where key = ${data.key}
    `;
    await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'settings.update', 'app_settings', ${data.key}, ${data.value})
    `;
    return { ok: true as const };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1).max(80),
      role: z.enum(["member", "admin"]),
      confirm: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await assertRateLimit(sql, `admin:role:${context.userId}`, 20, 3600);
    const target = await sql<{ email: string | null }>`
      select email from app_users where user_id = ${data.userId}
    `;
    if (data.role === "member") {
      assertCanDemoteAdmin(target[0]?.email);
      const remaining = await sql<{ n: number }>`
        select count(*)::int as n from app_users
        where role = 'admin' and is_synthetic = false and user_id <> ${data.userId}
      `;
      if ((remaining[0]?.n ?? 0) === 0) {
        throw new Error("Cannot remove the last administrator");
      }
    }
    await sql`update app_users set role = ${data.role} where user_id = ${data.userId}`;
    await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'user.role', 'app_users', ${data.userId}, ${data.role})
    `;
    return { ok: true as const };
  });

export const adminLedgerAdjustment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      memberId: z.string(),
      amount: z.number().int(),
      reason: z.string().min(3).max(200),
      confirm: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await assertRateLimit(sql, `admin:ledger:${context.userId}`, 20, 3600);
    if (Math.abs(data.amount) > 1_000_000) {
      throw new Error("Adjustment exceeds the allowed amount");
    }
    const wallet = await sql<{ owner_user_id: string; available_balance: number }>`
      select owner_user_id, available_balance from wallets where member_id = ${data.memberId}
    `;
    if (!wallet[0]) throw new Error("Wallet not found");
    const txId = uid();
    await sql`
      insert into wallet_transactions (
        id, member_id, owner_user_id, type, amount, source, status
      ) values (
        ${txId}, ${data.memberId}, ${wallet[0].owner_user_id}, 'ADJUSTMENT', ${data.amount}, ${data.reason}, 'posted'
      )
    `;
    await reconcileWallet(sql, data.memberId);
    await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'wallet.adjustment', 'wallets', ${data.memberId}, ${data.reason + " " + data.amount})
    `;
    return { ok: true as const, txId };
  });

export const adminReverseJoin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      sourceId: z.string(),
      reason: z.string().min(3).max(200),
      confirm: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await assertRateLimit(sql, `admin:reverse:${context.userId}`, 20, 3600);
    return reverseJoin(sql, {
      sourceId: data.sourceId,
      actorUserId: context.userId,
      reason: data.reason,
    });
  });

export const adminNetwork = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ memberId: z.string().optional() }).optional())
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const roots = await sql<{
      id: string;
      display_name: string;
      package_id: string;
      owner_user_id: string;
    }>`
      select m.id, u.display_name, m.package_id, m.owner_user_id
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      where m.is_root = true
      order by m.created_at desc
      limit 50
    `;
    const focus = data?.memberId ?? roots[0]?.id ?? null;
    if (!focus) return { roots, focus: null, children: [] as never[], progress: [] as never[], stats: null };
    const children = await sql<{
      child_id: string;
      parent_id: string;
      display_name: string;
      package_id: string;
      generation: number | null;
    }>`
      select p.child_id, p.parent_id, u.display_name, m.package_id, gm.generation
      from placement_relationships p
      join member_ids m on m.id = p.child_id
      join app_users u on u.user_id = m.owner_user_id
      left join generation_memberships gm on gm.member_id = p.child_id and gm.beneficiary_id = ${focus}
      where p.parent_id = ${focus} or gm.beneficiary_id = ${focus}
      order by coalesce(gm.generation, 1), m.created_at
      limit 200
    `;
    const progress = await sql<{
      level: number;
      completed_members: number;
      required_members: number;
      status: string;
    }>`
      select level, completed_members, required_members, status
      from level_progress where member_id = ${focus} order by level
    `;
    const directs = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships where sponsor_id = ${focus}
    `;
    const downline = await sql<{ n: number; depth: number }>`
      select count(*)::int as n, coalesce(max(generation),0)::int as depth
      from generation_memberships where beneficiary_id = ${focus}
    `;
    return {
      roots,
      focus,
      children,
      progress,
      stats: {
        directIds: directs[0]?.n ?? 0,
        downlineIds: downline[0]?.n ?? 0,
        networkDepth: downline[0]?.depth ?? 0,
      },
    };
  });

export const adminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const sales = await sql<{ package_id: string; n: number; value: number }>`
      select package_id, count(*)::int as n, coalesce(sum(amount_bdt),0)::int as value
      from package_purchases group by package_id
    `;
    const liability = await sql<{ held: number; released: number; available: number; reversed: number }>`
      select
        (select coalesce(sum(amount),0)::int from held_commissions) as held,
        (select coalesce(sum(total_released),0)::int from wallets) as released,
        (select coalesce(sum(available_balance),0)::int from wallets) as available,
        (select coalesce(sum(commission_amount),0)::int from commission_entries where status = 'REVERSED') as reversed
    `;
    const growth = await sql<{ day: string; n: number }>`
      select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as n
      from app_users
      group by 1
      order by 1 desc
      limit 14
    `;
    const idGrowth = await sql<{ day: string; n: number }>`
      select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as n
      from member_ids
      group by 1
      order by 1 desc
      limit 14
    `;
    return { sales, liability: liability[0], growth, idGrowth };
  });

export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      user_id: string;
      display_name: string;
      title: string;
      body: string;
      kind: string;
      read: boolean;
      created_at: string;
    }>`
      select n.id, n.user_id, u.display_name, n.title, n.body, n.kind, n.read, n.created_at
      from notifications n
      join app_users u on u.user_id = n.user_id
      order by n.created_at desc
      limit 200
    `;
  });
