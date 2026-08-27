import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, advisoryLock, dbSource } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/server/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertDurableMutations } from "@/lib/runtime";
import { uid } from "@/lib/engine/ids";
import { toInt } from "@/lib/money";
import { ensureProfileRow } from "@/lib/server/profile";

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "PAID", "REJECTED"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];
const OPEN = new Set(["PENDING", "APPROVED", "PROCESSING"]);

async function settingInt(sql: Awaited<ReturnType<typeof getSql>>, key: string, fallback: number) {
  const rows = await sql<{ value: string }>`select value from app_settings where key = ${key}`;
  const n = Number.parseInt(rows[0]?.value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    const rows = await sql<{
      id: string;
      member_id: string;
      amount_bdt: number;
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
      reviewed_at: string | null;
      paid_at: string | null;
    }>`
      select id, member_id, amount_bdt, payout_method, payout_details, status, user_note, admin_note,
             created_at, reviewed_at, paid_at
      from withdrawal_requests where owner_user_id = ${context.userId}
      order by created_at desc limit 50
    `;
    const min = await settingInt(sql, "withdrawal_min_bdt", 0);
    const fee = await settingInt(sql, "withdrawal_fee_bdt", 0);
    return { requests: rows, policy: { minBdt: min, feeBdt: fee, ownerConfigRequired: min === 0 && fee === 0 } };
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
      const owned = await tx<{ id: string }>`
        select id from member_ids where id = ${data.memberId} and owner_user_id = ${context.userId}
      `;
      if (!owned[0]) throw new Error("ID not found");
      const open = await tx<{ id: string }>`
        select id from withdrawal_requests
        where owner_user_id = ${context.userId} and status in ('PENDING','APPROVED','PROCESSING')
        limit 1
      `;
      if (open[0]) throw new Error("A withdrawal request is already in progress");
      const min = await settingInt(tx, "withdrawal_min_bdt", 0);
      const fee = await settingInt(tx, "withdrawal_fee_bdt", 0);
      if (min > 0 && data.amountBdt < min) throw new Error(`Minimum withdrawal is ${min} BDT`);
      const wallet = await tx<{ available_balance: number }>`
        select available_balance from wallets where member_id = ${data.memberId} for update
      `;
      const available = toInt(wallet[0]?.available_balance);
      if (data.amountBdt + fee > available) throw new Error("Amount exceeds available released balance");
      const id = uid();
      const reserveId = uid();
      await tx`
        insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
        values (${reserveId}, ${data.memberId}, ${context.userId}, 'WITHDRAWAL_RESERVE', ${-data.amountBdt}, ${"withdrawal " + id}, 'posted')
      `;
      if (fee > 0) {
        await tx`
          insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
          values (${uid()}, ${data.memberId}, ${context.userId}, 'WITHDRAWAL_FEE', ${-fee}, ${"withdrawal fee " + id}, 'posted')
        `;
      }
      await tx`
        update wallets set available_balance = available_balance - ${data.amountBdt + fee}, updated_at = now()
        where member_id = ${data.memberId} and available_balance >= ${data.amountBdt + fee}
      `;
      const details = { account: data.payoutAccount, name: data.payoutName };
      await tx`
        insert into withdrawal_requests (
          id, owner_user_id, member_id, amount_bdt, payout_method, payout_details, status, user_note, reserve_tx_id
        ) values (
          ${id}, ${context.userId}, ${data.memberId}, ${data.amountBdt}, ${data.payoutMethod},
          ${JSON.stringify(details)}::jsonb, 'PENDING', ${data.userNote ?? null}, ${reserveId}
        )
      `;
      await tx`
        insert into notifications (id, user_id, title, body, kind)
        values (${uid()}, ${context.userId}, ${"Withdrawal requested"}, ${data.amountBdt + " BDT is pending admin review. Held commission was not used."}, 'withdrawal')
      `;
      await tx`
        insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
        values (${uid()}, ${context.userId}, 'withdrawal.request', 'withdrawal_requests', ${id}, ${String(data.amountBdt)})
      `;
      return { id, status: "PENDING" as const, amountBdt: data.amountBdt };
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
      payout_method: string;
      payout_details: Record<string, string>;
      status: string;
      user_note: string | null;
      admin_note: string | null;
      created_at: string;
    }>`
      select w.id, w.owner_user_id, u.display_name, w.member_id, w.amount_bdt, w.payout_method,
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
      const row = await tx<{
        id: string;
        owner_user_id: string;
        member_id: string;
        amount_bdt: number;
        status: string;
        restore_tx_id: string | null;
        paid_tx_id: string | null;
      }>`select id, owner_user_id, member_id, amount_bdt, status, restore_tx_id, paid_tx_id from withdrawal_requests where id = ${data.id} for update`;
      if (!row[0]) throw new Error("Withdrawal request not found");
      const current = row[0];
      const next =
        data.action === "APPROVE" ? "APPROVED" : data.action === "PROCESS" ? "PROCESSING" : data.action === "PAY" ? "PAID" : "REJECTED";
      if (current.status === next || (current.status === "PAID" && data.action !== "REJECT")) {
        return { id: current.id, status: current.status, replayed: true as const };
      }
      if (current.status === "REJECTED" || current.status === "PAID") {
        throw new Error("This withdrawal can no longer change");
      }
      if (data.action === "REJECT") {
        if (!current.restore_tx_id) {
          const restoreId = uid();
          await tx`
            insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
            values (${restoreId}, ${current.member_id}, ${current.owner_user_id}, 'WITHDRAWAL_RESTORE', ${current.amount_bdt}, ${"withdrawal reject " + current.id}, 'posted')
          `;
          await tx`update wallets set available_balance = available_balance + ${current.amount_bdt}, updated_at = now() where member_id = ${current.member_id}`;
          await tx`update withdrawal_requests set restore_tx_id = ${restoreId} where id = ${current.id}`;
        }
      }
      if (data.action === "PAY" && !current.paid_tx_id) {
        const paidId = uid();
        await tx`
          insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
          values (${paidId}, ${current.member_id}, ${current.owner_user_id}, 'WITHDRAWAL_PAID', ${0}, ${"withdrawal paid " + current.id}, 'posted')
        `;
        await tx`update withdrawal_requests set paid_tx_id = ${paidId}, paid_at = now() where id = ${current.id}`;
      }
      await tx`
        update withdrawal_requests
        set status = ${next}, admin_note = ${data.note ?? null}, reviewed_by = ${context.userId},
            reviewed_at = now(), updated_at = now()
        where id = ${current.id}
      `;
      await tx`
        insert into notifications (id, user_id, title, body, kind)
        values (${uid()}, ${current.owner_user_id}, ${"Withdrawal " + next.toLowerCase()}, ${current.amount_bdt + " BDT is now " + next + "."}, 'withdrawal')
      `;
      await tx`
        insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
        values (${uid()}, ${context.userId}, ${"withdrawal." + next.toLowerCase()}, 'withdrawal_requests', ${current.id}, ${data.note ?? next})
      `;
      return { id: current.id, status: next, replayed: false as const };
    });
  });
