/**
 * Durable Link Mate tables that must survive every production redeploy.
 * Used by export/restore. Auth tables are quoted — "user" is reserved in Postgres.
 */
export const DURABLE_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "packages",
  "commission_rules",
  "app_users",
  "package_purchases",
  "payments",
  "user_packages",
  "member_ids",
  "sponsor_relationships",
  "placement_relationships",
  "generation_memberships",
  "level_progress",
  "commission_entries",
  "held_commissions",
  "wallets",
  "wallet_transactions",
  "notifications",
  "audit_logs",
  "app_settings",
  "purchase_idempotency",
  "rate_limits",
  "payment_method_settings",
  "payment_requests",
  "withdrawal_requests",
];

/** Insert order respects foreign keys. */
export const RESTORE_ORDER = DURABLE_TABLES;

/** @param {string} name */
export function sqlTable(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing unsafe table name: ${name}`);
  }
  return `"${name}"`;
}
