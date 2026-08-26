import { PACKAGES, type PackageId } from "./rules.ts";

export const PAYMENT_METHODS = ["BKASH", "NAGAD", "BANK", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending Verification",
  NEEDS_REVIEW: "Needs Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  BANK: "Bank",
  CASH: "Cash",
};

export function normalizePaymentReference(method: PaymentMethod, raw: string | null | undefined): string | null {
  if (method === "CASH") return null;
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, "").toUpperCase();
}

export function expectedPackageAmount(packageId: PackageId): number {
  return PACKAGES[packageId].amountBdt;
}

export function paymentRequiresReference(method: PaymentMethod): boolean {
  return method !== "CASH";
}
