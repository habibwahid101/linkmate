import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, advisoryLock, dbSource } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/server/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertDurableMutations } from "@/lib/runtime";
import { ensureProfileRow } from "@/lib/server/profile";
import {
  createWithdrawalRequest,
  loadWithdrawalPolicy,
  previewWithdrawal,
  processWithdrawalRequest,
} from "@/lib/withdrawals/engine";

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "PAID", "REJECTED"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    const rows = await sql<{
      id: string;
      member_id: string;
      amount_bdt: number;
      fee_bdt: number;
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
      reviewed_at: string | null;
      paid_at: string | null;
    }>`
      select id, member_id, amount_bdt, coalesce(fee_bdt,0)::int as fee_bdt, payout_method, payout_details, status, user_note, admin_note,
             created_at, reviewed_at, paid_at
      from withdrawal_requests where owner_user_id = ${context.userId}
      order by created_at desc limit 50
    `;
    const policy = await loadWithdrawalPolicy(sql);
    return {
      requests: rows,
      policy: {
        minBdt: policy.minBdt,
        feeBps: policy.feeBps,
        feePercent: policy.feeBps / 100,
        ownerConfigRequired: false,
      },
    };
  });

export const quoteMyWithdrawal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ amountBdt: z.number().int() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return previewWithdrawal(sql, data.amountBdt);
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      memberId: z.string().min(1).max(40),
      amountBdt: z.number().int().positive(),
      payoutMethod: z.enum(["bkash", "nagad", "bank"]),
      payoutAccount: z.string().min(4).max(80),
      payoutName: z.string().min(2).max(80),
      userNote: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertDurableMutations((key) => process.env[key], dbSource);
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `withdraw:${context.userId}`);
      await assertRateLimit(tx, `withdraw:${context.userId}`, 8, 3600);
      const created = await createWithdrawalRequest(tx, {
        userId: context.userId,
        memberId: data.memberId,
        amountBdt: data.amountBdt,
        payoutMethod: data.payoutMethod,
        payoutAccount: data.payoutAccount,
        payoutName: data.payoutName,
        userNote: data.userNote,
      });
      return {
        id: created.id,
        status: created.status,
        amountBdt: created.quote.amountBdt,
        feeBdt: created.quote.feeBdt,
        netBdt: created.quote.netBdt,
      };
    });
  });

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        status: z.enum(WITHDRAWAL_STATUSES).optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    type Row = {
      id: string;
      owner_user_id: string;
      display_name: string;
      email: string | null;
      member_id: string;
      amount_bdt: number;
      fee_bdt: number;
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
      reviewed_at: string | null;
      paid_at: string | null;
    };
    if (data?.status) {
      return sql<Row>`
        select w.id, w.owner_user_id, u.display_name, u.email, w.member_id, w.amount_bdt,
               coalesce(w.fee_bdt,0)::int as fee_bdt, w.payout_method, w.payout_details, w.status,
               w.user_note, w.admin_note, w.created_at, w.reviewed_at, w.paid_at
        from withdrawal_requests w
        join app_users u on u.user_id = w.owner_user_id
        where w.status = ${data.status}
        order by w.created_at desc limit 200
      `;
    }
    return sql<Row>`
      select w.id, w.owner_user_id, u.display_name, u.email, w.member_id, w.amount_bdt,
             coalesce(w.fee_bdt,0)::int as fee_bdt, w.payout_method, w.payout_details, w.status,
             w.user_note, w.admin_note, w.created_at, w.reviewed_at, w.paid_at
      from withdrawal_requests w
      join app_users u on u.user_id = w.owner_user_id
      order by w.created_at desc limit 200
    `;
  });

export const adminWithdrawalSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const counts = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from withdrawal_requests group by status
    `;
    const map = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    return {
      pending: (map.PENDING ?? 0) + (map.APPROVED ?? 0) + (map.PROCESSING ?? 0),
      awaitingPay: (map.APPROVED ?? 0) + (map.PROCESSING ?? 0),
      paid: map.PAID ?? 0,
      rejected: map.REJECTED ?? 0,
    };
  });

export const adminGetWithdrawal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      owner_user_id: string;
      display_name: string;
      email: string | null;
      member_id: string;
      amount_bdt: number;
      fee_bdt: number;
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
      reviewed_at: string | null;
      paid_at: string | null;
    }>`
      select w.id, w.owner_user_id, u.display_name, u.email, w.member_id, w.amount_bdt,
             coalesce(w.fee_bdt,0)::int as fee_bdt, w.payout_method, w.payout_details, w.status,
             w.user_note, w.admin_note, w.created_at, w.reviewed_at, w.paid_at
      from withdrawal_requests w
      join app_users u on u.user_id = w.owner_user_id
      where w.id = ${data.id}
    `;
    const row = rows[0];
    if (!row) throw new Error("Withdrawal request not found");
    const audit = await sql<{
      id: string;
      actor_user_id: string | null;
      action: string;
      detail: string | null;
      created_at: string;
    }>`
      select id, actor_user_id, action, detail, created_at
      from audit_logs
      where entity_type = 'withdrawal_requests' and entity_id = ${data.id}
      order by created_at desc
      limit 20
    `;
    return {
      ...row,
      net_bdt: row.amount_bdt - row.fee_bdt,
      audit,
    };
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().min(1),
      action: z.enum(["APPROVE", "PROCESS", "PAY", "REJECT"]),
      note: z.string().max(400).optional(),
      confirm: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    assertDurableMutations((key) => process.env[key], dbSource);
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `withdraw-admin:${data.id}`);
      return processWithdrawalRequest(tx, {
        adminUserId: context.userId,
        id: data.id,
        action: data.action,
        note: data.note,
      });
    });
  });
