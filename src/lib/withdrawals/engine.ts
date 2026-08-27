import { uid } from "../engine/ids.ts";
import { toInt } from "../money.ts";
import {
  WITHDRAWAL_FEE_BPS_KEY,
  WITHDRAWAL_MIN_KEY,
  assertWithdrawalQuote,
  quoteWithdrawal,
  type WithdrawalQuote,
} from "./policy.ts";

export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

export type WithdrawalPolicy = { minBdt: number; feeBps: number };

async function settingInt(sql: Sql, key: string, fallback: number): Promise<number> {
  const rows = await sql<{ value: string }>`select value from app_settings where key = ${key}`;
  const n = Number.parseInt(rows[0]?.value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadWithdrawalPolicy(sql: Sql): Promise<WithdrawalPolicy> {
  const minBdt = await settingInt(sql, WITHDRAWAL_MIN_KEY, 500);
  const feeBps = await settingInt(sql, WITHDRAWAL_FEE_BPS_KEY, 500);
  return { minBdt, feeBps };
}

export async function previewWithdrawal(
  sql: Sql,
  amountBdt: number,
): Promise<WithdrawalQuote> {
  return quoteWithdrawal(amountBdt, await loadWithdrawalPolicy(sql));
}

export async function createWithdrawalRequest(
  sql: Sql,
  input: {
    userId: string;
    memberId: string;
    amountBdt: number;
    payoutMethod: "bkash" | "nagad" | "bank";
    payoutAccount: string;
    payoutName: string;
    userNote?: string;
  },
): Promise<{ id: string; status: "PENDING"; quote: WithdrawalQuote }> {
  const owned = await sql<{ id: string }>`
    select id from member_ids where id = ${input.memberId} and owner_user_id = ${input.userId}
  `;
  if (!owned[0]) throw new Error("ID not found");
  const open = await sql<{ id: string }>`
    select id from withdrawal_requests
    where owner_user_id = ${input.userId} and status in ('PENDING','APPROVED','PROCESSING')
    limit 1
  `;
  if (open[0]) throw new Error("A withdrawal request is already in progress");

  const policy = await loadWithdrawalPolicy(sql);
  const quote = quoteWithdrawal(input.amountBdt, policy);
  const wallet = await sql<{ available_balance: number }>`
    select available_balance from wallets where member_id = ${input.memberId} for update
  `;
  const available = toInt(wallet[0]?.available_balance);
  assertWithdrawalQuote(quote, available);

  const id = uid();
  const reserveId = uid();
  const feeTxId = uid();
  await sql`
    insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
    values (${reserveId}, ${input.memberId}, ${input.userId}, 'WITHDRAWAL_RESERVE', ${-quote.amountBdt}, ${"withdrawal " + id}, 'posted')
  `;
  await sql`
    insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
    values (${feeTxId}, ${input.memberId}, ${input.userId}, 'WITHDRAWAL_FEE', ${0}, ${"withdrawal fee " + quote.feeBdt + " net " + quote.netBdt + " " + id}, 'posted')
  `;
  await sql`
    update wallets set available_balance = available_balance - ${quote.amountBdt}, updated_at = now()
    where member_id = ${input.memberId} and available_balance >= ${quote.amountBdt}
  `;
  const details = {
    account: input.payoutAccount,
    name: input.payoutName,
    feeBdt: String(quote.feeBdt),
    netBdt: String(quote.netBdt),
    feeBps: String(quote.feeBps),
  };
  await sql`
    insert into withdrawal_requests (
      id, owner_user_id, member_id, amount_bdt, fee_bdt, payout_method, payout_details, status, user_note, reserve_tx_id
    ) values (
      ${id}, ${input.userId}, ${input.memberId}, ${quote.amountBdt}, ${quote.feeBdt}, ${input.payoutMethod},
      ${JSON.stringify(details)}::jsonb, 'PENDING', ${input.userNote ?? null}, ${reserveId}
    )
  `;
  await sql`
    insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${input.userId}, ${"Withdrawal requested"}, ${quote.amountBdt + " BDT requested. Fee " + quote.feeBdt + " BDT. Net " + quote.netBdt + " BDT. Held commission was not used."}, 'withdrawal')
  `;
  await sql`
    insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
    values (${uid()}, ${input.userId}, 'withdrawal.request', 'withdrawal_requests', ${id}, ${`amount=${quote.amountBdt} fee=${quote.feeBdt} net=${quote.netBdt}`})
  `;
  return { id, status: "PENDING", quote };
}

export async function processWithdrawalRequest(
  sql: Sql,
  input: {
    adminUserId: string;
    id: string;
    action: "APPROVE" | "PROCESS" | "PAY" | "REJECT";
    note?: string;
  },
): Promise<{ id: string; status: string; replayed: boolean }> {
  const row = await sql<{
    id: string;
    owner_user_id: string;
    member_id: string;
    amount_bdt: number;
    fee_bdt: number;
    status: string;
    restore_tx_id: string | null;
    paid_tx_id: string | null;
  }>`select id, owner_user_id, member_id, amount_bdt, coalesce(fee_bdt,0)::int as fee_bdt, status, restore_tx_id, paid_tx_id from withdrawal_requests where id = ${input.id} for update`;
  if (!row[0]) throw new Error("Withdrawal request not found");
  const current = row[0];
  const next =
    input.action === "APPROVE"
      ? "APPROVED"
      : input.action === "PROCESS"
        ? "PROCESSING"
        : input.action === "PAY"
          ? "PAID"
          : "REJECTED";
  if (current.status === next || (current.status === "PAID" && input.action !== "REJECT")) {
    return { id: current.id, status: current.status, replayed: true };
  }
  if (current.status === "REJECTED" || current.status === "PAID") {
    throw new Error("This withdrawal can no longer change");
  }
  if (input.action === "REJECT") {
    if (!current.restore_tx_id) {
      const restoreId = uid();
      await sql`
        insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
        values (${restoreId}, ${current.member_id}, ${current.owner_user_id}, 'WITHDRAWAL_RESTORE', ${current.amount_bdt}, ${"withdrawal reject " + current.id}, 'posted')
      `;
      await sql`update wallets set available_balance = available_balance + ${current.amount_bdt}, updated_at = now() where member_id = ${current.member_id}`;
      await sql`update withdrawal_requests set restore_tx_id = ${restoreId} where id = ${current.id}`;
    }
  }
  if (input.action === "PAY" && !current.paid_tx_id) {
    const paidId = uid();
    const fee = toInt(current.fee_bdt);
    const net = toInt(current.amount_bdt) - fee;
    await sql`
      insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
      values (${paidId}, ${current.member_id}, ${current.owner_user_id}, 'WITHDRAWAL_PAID', ${0}, ${"withdrawal paid net " + net + " fee " + fee + " " + current.id}, 'posted')
    `;
    await sql`update withdrawal_requests set paid_tx_id = ${paidId}, paid_at = now() where id = ${current.id}`;
  }
  await sql`
    update withdrawal_requests
    set status = ${next}, admin_note = ${input.note ?? null}, reviewed_by = ${input.adminUserId},
        reviewed_at = now(), updated_at = now()
    where id = ${current.id}
  `;
  await sql`
    insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${current.owner_user_id}, ${"Withdrawal " + next.toLowerCase()}, ${current.amount_bdt + " BDT is now " + next + "."}, 'withdrawal')
  `;
  await sql`
    insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
    values (${uid()}, ${input.adminUserId}, ${"withdrawal." + next.toLowerCase()}, 'withdrawal_requests', ${current.id}, ${input.note ?? next})
  `;
  return { id: current.id, status: next, replayed: false };
}
