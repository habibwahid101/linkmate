import { toInt } from "../money.ts";

/** Basis points: 500 = 5.00%. */
export const WITHDRAWAL_MIN_KEY = "withdrawal_min_bdt";
export const WITHDRAWAL_FEE_BPS_KEY = "withdrawal_fee_bps";
export const WITHDRAWAL_PAYOUT_SCHEDULE_KEY = "withdrawal_payout_schedule";
export const WITHDRAWAL_TAX_POLICY_KEY = "withdrawal_tax_policy";

export const WITHDRAWAL_PAYOUT_SCHEDULE =
  "Manual payout within 1–3 business days after admin approval.";
export const WITHDRAWAL_TAX_POLICY =
  "No fixed platform tax deduction. Statutory tax follows prevailing law and accounting policy.";

export type WithdrawalQuote = {
  amountBdt: number;
  feeBdt: number;
  netBdt: number;
  minBdt: number;
  feeBps: number;
};

/**
 * Integer BDT fee from basis points.
 * Rounding: half-up via Math.round on amount * bps / 10_000.
 * 1000 @ 500bps = 50; 555 @ 500bps = 28.
 */
export function withdrawalFeeBdt(amountBdt: number, feeBps: number): number {
  const amount = toInt(amountBdt);
  const bps = toInt(feeBps);
  if (amount <= 0 || bps <= 0) return 0;
  return Math.round((amount * bps) / 10_000);
}

export function quoteWithdrawal(
  amountBdt: number,
  policy: { minBdt: number; feeBps: number },
): WithdrawalQuote {
  const amount = toInt(amountBdt);
  const feeBdt = withdrawalFeeBdt(amount, policy.feeBps);
  return {
    amountBdt: amount,
    feeBdt,
    netBdt: amount - feeBdt,
    minBdt: toInt(policy.minBdt),
    feeBps: toInt(policy.feeBps),
  };
}

export function assertWithdrawalQuote(
  quote: WithdrawalQuote,
  availableBdt: number,
): void {
  if (quote.amountBdt <= 0) throw new Error("Enter a withdrawal amount");
  if (quote.minBdt > 0 && quote.amountBdt < quote.minBdt) {
    throw new Error(`Minimum withdrawal is ${quote.minBdt} BDT`);
  }
  if (quote.netBdt <= 0) throw new Error("Fee would consume the full amount");
  if (quote.amountBdt > toInt(availableBdt)) {
    throw new Error("Amount exceeds available released balance");
  }
}
