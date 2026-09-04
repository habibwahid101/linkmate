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
      select count(*)::int as n from payment_requests
      where status in ('PENDING', 'NEEDS_REVIEW')
    `;

    return {
      totalUsers: users[0]?.n ?? 0,
      totalAccounts: allUsers[0]?.n ?? 0,
      activeIds: ids[0]?.n ?? 0,
      packages: byPkg,
      joiningValue: toInt(joining[0]?.v),
      held: toInt(held[0]?.v),
      released: toInt(released[0]?.v),
      walletLiabilities: toInt(available[0]?.v),
      pendingPayments: pendingPayments[0]?.n ?? 0,
      completions,
      recentPurchases,
      levels: LEVELS,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return (await sql<{
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
    `).map((u) => ({ ...u, locked: isLockedAdminEmail(u.email) }));
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
      created_at: string;
    }>`
      select m.id, m.owner_user_id, u.display_name, m.package_id, m.sponsor_id, m.parent_id,
             m.placement_status, m.status, m.created_at
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      order by m.created_at desc
      limit 300
    `;
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
    }>`
      select w.member_id, w.owner_user_id, u.display_name, w.available_balance, w.total_released
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
    if (!focus) return { roots, focus: null, children: [] as never[], progress: [] as never[] };
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
    return { roots, focus, children, progress };
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
    const liability = await sql<{ held: number; released: number; available: number }>`
      select
        (select coalesce(sum(amount),0)::int from held_commissions) as held,
        (select coalesce(sum(total_released),0)::int from wallets) as released,
        (select coalesce(sum(available_balance),0)::int from wallets) as available
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
