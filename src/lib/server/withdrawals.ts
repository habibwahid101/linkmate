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
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      owner_user_id: string;
      display_name: string;
      member_id: string;
      amount_bdt: number;
      fee_bdt: number;
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
    }>`
      select w.id, w.owner_user_id, u.display_name, w.member_id, w.amount_bdt, coalesce(w.fee_bdt,0)::int as fee_bdt, w.payout_method,
             w.payout_details, w.status, w.user_note, w.admin_note, w.created_at
      from withdrawal_requests w
      join app_users u on u.user_id = w.owner_user_id
      order by w.created_at desc limit 200
    `;
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
