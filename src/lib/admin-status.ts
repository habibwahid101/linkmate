export type AdminStatusTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "held"
  | "locked"
  | "danger"
  | "info"
  | "progress"
  | "package"
  | "available";

export type AdminStatusVisual = {
  tone: AdminStatusTone;
  label: string;
};

const STATUS_VISUAL: Record<string, AdminStatusVisual> = {
  LOCKED: { tone: "locked", label: "Locked" },
  IN_PROGRESS: { tone: "progress", label: "In Progress" },
  ELIGIBLE: { tone: "warning", label: "Eligible" },
  COMPLETED: { tone: "success", label: "Completed" },
  RELEASED: { tone: "success", label: "Released" },
  HELD: { tone: "held", label: "Held" },
  REVERSED: { tone: "danger", label: "Reversed" },
  PENDING: { tone: "held", label: "Pending Verification" },
  NEEDS_REVIEW: { tone: "warning", label: "Needs Review" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  PROCESSING: { tone: "progress", label: "Processing" },
  PAID: { tone: "success", label: "Paid" },
  AVAILABLE: { tone: "available", label: "Available" },
  QUALIFIED: { tone: "success", label: "Qualified" },
  "Not Yet Qualified": { tone: "held", label: "Not Yet Qualified" },
  GRADUATED: { tone: "success", label: "Graduated" },
  ACTIVE: { tone: "info", label: "Active" },
  placed: { tone: "info", label: "Placed" },
  pending_config: { tone: "warning", label: "Unplaced" },
  posted: { tone: "success", label: "Posted" },
  completed: { tone: "success", label: "Completed" },
};

export function statusVisual(status: string): AdminStatusVisual {
  return STATUS_VISUAL[status] ?? { tone: "neutral", label: status };
}

export const ADMIN_EMPTY = {
  payments: {
    title: "No payment requests",
    body: "Nothing is waiting for verification in this filter. Submission never activates a package.",
  },
  withdrawals: {
    title: "No withdrawal requests",
    body: "When members request a payout of BDT 500 or more, it will appear here for processing.",
  },
  users: {
    title: "No accounts yet",
    body: "Member accounts will appear here. One account may own 1, 4, 13, or 22 Membership IDs.",
  },
  ids: {
    title: "No Membership IDs yet",
    body: "IDs are created only when an admin approves a package payment.",
  },
  purchases: {
    title: "No package purchases",
    body: "Approved payments create purchases and Membership IDs together.",
  },
  qualification: {
    title: "No qualification records",
    body: "Land qualification is computed from Membership status, 3 Direct IDs, and Level 9. Qualification is not legal transfer.",
  },
  commissions: {
    title: "No commission rows",
    body: "Held, released, and reversed ledger entries will list here.",
  },
  held: {
    title: "No held commission",
    body: "Held commission is not withdrawable. Nothing here is in a member wallet yet.",
  },
  wallets: {
    title: "No wallets yet",
    body: "Wallets are created with Membership IDs. Available is distinct from released and held.",
  },
  transactions: {
    title: "No ledger rows",
    body: "Wallet transactions for Membership IDs will appear here.",
  },
  audit: {
    title: "No audit events",
    body: "Payment review, package activation, and withdrawal processing are recorded as they happen.",
  },
  notifications: {
    title: "No notifications",
    body: "Member notifications will list here once the platform is in use.",
  },
} as const;
