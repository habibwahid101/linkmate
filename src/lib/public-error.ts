/** Map technical errors to user-facing copy. Never leak stacks or SQL. */

const KNOWN = [
  "Unauthorized",
  "Forbidden",
  "Too many attempts",
  "Online payment is not available yet",
  "Manual payment is not available",
  "This payment method is not available",
  "This payment method is not configured",
  "Transaction / reference ID is required",
  "Amount does not match the locked package price",
  "This transaction was already approved",
  "Rejected payments cannot be approved",
  "Approved payments cannot be rejected",
  "Payment request not found",
  "Rejection reason is required",
  "Enter the amount paid",
  "This payment cannot be approved",
  "Purchasing is not open",
  "Invalid referral",
  "Sample network is disabled",
  "Simulated joins are disabled",
  "ID not found",
  "Unknown setting",
  "Adjustment exceeds",
  "Cannot remove the last administrator",
  "Cannot demote a platform administrator",
  "Wallet not found",
  "Sample data is only available",
  "You can only simulate joins",
];

export function publicErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return "Something went wrong. Try again.";
  if (/stack|ECONNREFUSED|ECONNRESET|ENOTFOUND|database|postgres|pglite|sql|DATABASE_URL|ephemeral storage/i.test(raw) && !KNOWN.some((k) => raw.includes(k))) {
    return "The service is temporarily unavailable. Try again shortly.";
  }
  if (KNOWN.some((k) => raw.includes(k))) {
    if (raw.includes("Too many attempts")) return "Too many attempts. Try again in a few minutes.";
    if (raw.includes("Invalid referral")) return "Invalid referral code.";
    if (raw.includes("Forbidden") || raw.includes("Unauthorized")) return raw.includes("Forbidden") ? "You do not have access to that." : "Please sign in again.";
    return raw;
  }
  if (/invalid email or password|invalid password|user not found|invalid credentials/i.test(raw)) {
    return "Email or password is incorrect.";
  }
  if (raw.length > 180 || /at\s+\S+\s+\(/.test(raw)) {
    return "Something went wrong. Try again.";
  }
  return raw;
}
