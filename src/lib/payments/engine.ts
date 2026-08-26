import { PACKAGES, type PackageId } from "../rules.ts";
import { createIdsForPurchase } from "../engine/process.ts";
import { uid } from "../engine/ids.ts";
import {
  type PaymentMethod,
  type PaymentStatus,
  expectedPackageAmount,
  normalizePaymentReference,
  paymentRequiresReference,
} from "../payments.ts";

export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

export type PaymentSettingsRow = {
  method: PaymentMethod;
  enabled: boolean;
  number: string | null;
  account_type: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch: string | null;
  routing_number: string | null;
  swift: string | null;
  instructions: string;
};

export type PaymentRequestRow = {
  id: string;
  user_id: string;
  package_id: PackageId;
  expected_amount_bdt: number;
  submitted_amount_bdt: number;
  payment_method: PaymentMethod;
  transaction_reference: string | null;
  transaction_reference_norm: string | null;
  user_note: string | null;
  extra: Record<string, string>;
  proof_reference: string | null;
  duplicate_suspect: boolean;
  status: PaymentStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  purchase_id: string | null;
  approval_event_id: string | null;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmitPaymentInput = {
  userId: string;
  packageId: PackageId;
  method: PaymentMethod;
  submittedAmountBdt: number;
  transactionReference?: string;
  userNote?: string;
  extra?: Record<string, string>;
  referralCode?: string;
};

async function notify(
  sql: Sql,
  userId: string,
  title: string,
  body: string,
  kind: string,
) {
  await sql`
    insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${userId}, ${title}, ${body}, ${kind})
  `;
}

async function audit(
  sql: Sql,
  actor: string | null,
  action: string,
  entityId: string,
  detail: string,
) {
  await sql`
    insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
    values (${uid()}, ${actor}, ${action}, 'payment_requests', ${entityId}, ${detail})
  `;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

export function assertPaymentOwner(row: PaymentRequestRow | null, userId: string): PaymentRequestRow {
  if (!row || row.user_id !== userId) throw new Error("Payment request not found");
  return row;
}

export async function loadPaymentSettings(sql: Sql): Promise<PaymentSettingsRow[]> {
  const rows = await sql<PaymentSettingsRow>`
    select method, enabled, number, account_type, bank_name, account_name, account_number,
           branch, routing_number, swift, instructions
    from payment_method_settings order by method
  `;
  return rows;
}

export async function getPaymentMethod(sql: Sql, method: PaymentMethod): Promise<PaymentSettingsRow | null> {
  const rows = await sql<PaymentSettingsRow>`
    select method, enabled, number, account_type, bank_name, account_name, account_number,
           branch, routing_number, swift, instructions
    from payment_method_settings where method = ${method}
  `;
  return rows[0] ?? null;
}

export async function savePaymentMethod(
  sql: Sql,
  adminUserId: string,
  patch: Partial<PaymentSettingsRow> & { method: PaymentMethod },
): Promise<void> {
  const current = await getPaymentMethod(sql, patch.method);
  if (!current) throw new Error("Unknown payment method");
  const next = { ...current, ...patch };
  await sql`
    update payment_method_settings set
      enabled = ${Boolean(next.enabled)},
      number = ${next.number ?? null},
      account_type = ${next.account_type ?? null},
      bank_name = ${next.bank_name ?? null},
      account_name = ${next.account_name ?? null},
      account_number = ${next.account_number ?? null},
      branch = ${next.branch ?? null},
      routing_number = ${next.routing_number ?? null},
      swift = ${next.swift ?? null},
      instructions = ${next.instructions ?? ""},
      updated_at = now(),
      updated_by = ${adminUserId}
    where method = ${patch.method}
  `;
  await audit(sql, adminUserId, "payment.settings", patch.method, next.enabled ? "enabled" : "disabled");
}

async function resolveSponsor(sql: Sql, referralCode: string | undefined): Promise<string | null> {
  const code = referralCode?.trim().toUpperCase();
  if (!code) return null;
  const byUser = await sql<{ user_id: string; active_id: string | null }>`
    select user_id, active_id from app_users where upper(referral_code) = ${code}
  `;
  if (byUser[0]) {
    if (byUser[0].active_id) return byUser[0].active_id;
    const first = await sql<{ id: string }>`
      select id from member_ids where owner_user_id = ${byUser[0].user_id}
      order by created_at asc limit 1
    `;
    return first[0]?.id ?? null;
  }
  const byId = await sql<{ id: string }>`select id from member_ids where id = ${code}`;
  if (!byId[0]) throw new Error("Invalid referral code");
  return byId[0].id;
}

export async function submitPaymentRequest(sql: Sql, input: SubmitPaymentInput): Promise<PaymentRequestRow> {
  const pkg = PACKAGES[input.packageId];
  const expected = expectedPackageAmount(input.packageId);
  const settings = await getPaymentMethod(sql, input.method);
  if (!settings?.enabled) throw new Error("This payment method is not available.");
  if (input.submittedAmountBdt <= 0) throw new Error("Enter the amount paid.");
  const norm = normalizePaymentReference(input.method, input.transactionReference);
  if (paymentRequiresReference(input.method) && !norm) {
    throw new Error("Transaction / reference ID is required.");
  }
  if (input.method !== "CASH") {
    const needsAccount =
      input.method === "BANK" ? !settings.account_number : !settings.number;
    if (needsAccount) throw new Error("This payment method is not configured yet.");
  }
  if (input.referralCode?.trim()) {
    await resolveSponsor(sql, input.referralCode);
  }

  let duplicateSuspect = false;
  if (norm) {
    const dup = await sql<{ id: string; status: string }>`
      select id, status from payment_requests
      where payment_method = ${input.method}
        and transaction_reference_norm = ${norm}
        and status in ('PENDING', 'NEEDS_REVIEW', 'APPROVED')
      limit 1
    `;
    duplicateSuspect = Boolean(dup[0]);
  }

  const id = uid();
  const extra = JSON.stringify(input.extra ?? {});
  await sql`
    insert into payment_requests (
      id, user_id, package_id, expected_amount_bdt, submitted_amount_bdt,
      payment_method, transaction_reference, transaction_reference_norm,
      user_note, extra, duplicate_suspect, status, referral_code
    ) values (
      ${id}, ${input.userId}, ${pkg.id}, ${expected}, ${input.submittedAmountBdt},
      ${input.method}, ${input.transactionReference?.trim() || null}, ${norm},
      ${input.userNote?.trim() || null}, ${extra}::jsonb, ${duplicateSuspect}, 'PENDING',
      ${input.referralCode?.trim().toUpperCase() || null}
    )
  `;
  await notify(
    sql,
    input.userId,
    "Payment submitted",
    `${pkg.name} · ৳${expected.toLocaleString("en-US")} is pending admin verification. Your package is not active yet.`,
    "payment",
  );
  await audit(sql, input.userId, "payment.submitted", id, `${input.method} ${pkg.id}`);
  const rows = await sql<PaymentRequestRow>`select * from payment_requests where id = ${id}`;
  return hydrate(rows[0]!);
}

function hydrate(row: PaymentRequestRow): PaymentRequestRow {
  const extra = row.extra as unknown;
  return {
    ...row,
    extra: typeof extra === "string" ? asStringRecord(JSON.parse(extra)) : asStringRecord(extra),
    expected_amount_bdt: Number(row.expected_amount_bdt),
    submitted_amount_bdt: Number(row.submitted_amount_bdt),
    duplicate_suspect: Boolean(row.duplicate_suspect),
  };
}

export async function getPaymentRequest(
  sql: Sql,
  id: string,
  opts?: { forUpdate?: boolean },
): Promise<PaymentRequestRow | null> {
  const rows = opts?.forUpdate
    ? await sql<PaymentRequestRow>`select * from payment_requests where id = ${id} for update`
    : await sql<PaymentRequestRow>`select * from payment_requests where id = ${id}`;
  return rows[0] ? hydrate(rows[0]) : null;
}

export async function listUserPayments(sql: Sql, userId: string): Promise<PaymentRequestRow[]> {
  const rows = await sql<PaymentRequestRow>`
    select * from payment_requests where user_id = ${userId} order by created_at desc
  `;
  return rows.map(hydrate);
}

async function fulfill(
  sql: Sql,
  req: PaymentRequestRow,
  approvalEventId: string,
  adminUserId: string,
): Promise<{ purchaseId: string; rootId: string; ids: string[] }> {
  const pkg = PACKAGES[req.package_id];
  const sponsorMemberId = await resolveSponsor(sql, req.referral_code ?? undefined);
  const purchaseId = uid();
  const paymentId = uid();
  await sql`
    insert into package_purchases (
      id, user_id, package_id, amount_bdt, id_count, referral_code, sponsor_member_id,
      payment_status, payment_request_id
    ) values (
      ${purchaseId}, ${req.user_id}, ${pkg.id}, ${pkg.amountBdt}, ${pkg.idCount},
      ${req.referral_code}, ${sponsorMemberId}, 'completed', ${req.id}
    )
  `;
  await sql`
    insert into payments (id, purchase_id, amount_bdt, method, status)
    values (${paymentId}, ${purchaseId}, ${pkg.amountBdt}, ${req.payment_method.toLowerCase()}, 'completed')
  `;
  await sql`
    insert into user_packages (id, user_id, package_id, purchase_id)
    values (${uid()}, ${req.user_id}, ${pkg.id}, ${purchaseId})
  `;
  const created = await createIdsForPurchase(sql, {
    userId: req.user_id,
    packageId: req.package_id,
    purchaseId,
    externalSponsorId: sponsorMemberId,
  });
  const profile = await sql<{ active_id: string | null }>`
    select active_id from app_users where user_id = ${req.user_id}
  `;
  if (!profile[0]?.active_id) {
    await sql`update app_users set active_id = ${created.rootId} where user_id = ${req.user_id}`;
  }
  await sql`
    update payment_requests
    set status = 'APPROVED',
        purchase_id = ${purchaseId},
        approval_event_id = ${approvalEventId},
        reviewed_by = ${adminUserId},
        reviewed_at = now(),
        updated_at = now()
    where id = ${req.id}
      and status in ('PENDING', 'NEEDS_REVIEW')
  `;
  await notify(
    sql,
    req.user_id,
    "Payment approved",
    `${pkg.name} is active. ${created.ids.length} ID(s) issued. Root ${created.rootId}.`,
    "purchase",
  );
  await notify(
    sql,
    req.user_id,
    "Package activated",
    `${pkg.name} membership is now active.`,
    "purchase",
  );
  return { purchaseId, rootId: created.rootId, ids: created.ids };
}

export async function approvePayment(
  sql: Sql,
  opts: { requestId: string; adminUserId: string },
): Promise<{ purchaseId: string; rootId: string; ids: string[]; replayed: boolean }> {
  const req = await getPaymentRequest(sql, opts.requestId, { forUpdate: true });
  if (!req) throw new Error("Payment request not found");
  if (req.status === "APPROVED" && req.purchase_id) {
    const ids = await sql<{ id: string }>`
      select id from member_ids where purchase_id = ${req.purchase_id} order by created_at
    `;
    const purchase = await sql<{ root_id: string | null }>`
      select root_id from package_purchases where id = ${req.purchase_id}
    `;
    return {
      purchaseId: req.purchase_id,
      rootId: purchase[0]?.root_id ?? ids[0]?.id ?? "",
      ids: ids.map((r) => r.id),
      replayed: true,
    };
  }
  if (req.status === "REJECTED") throw new Error("Rejected payments cannot be approved.");
  if (req.status !== "PENDING" && req.status !== "NEEDS_REVIEW") {
    throw new Error("This payment cannot be approved.");
  }
  const expected = expectedPackageAmount(req.package_id);
  if (req.expected_amount_bdt !== expected || req.submitted_amount_bdt !== expected) {
    throw new Error("Amount does not match the locked package price.");
  }
  if (req.transaction_reference_norm) {
    const taken = await sql<{ id: string }>`
      select id from payment_requests
      where payment_method = ${req.payment_method}
        and transaction_reference_norm = ${req.transaction_reference_norm}
        and status = 'APPROVED'
        and id <> ${req.id}
      limit 1
    `;
    if (taken[0]) throw new Error("This transaction was already approved on another request.");
  }
  const approvalEventId = uid();
  try {
    const result = await fulfill(sql, req, approvalEventId, opts.adminUserId);
    await audit(sql, opts.adminUserId, "payment.approved", req.id, result.purchaseId);
    return { ...result, replayed: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique constraint|payment_requests_approved_ref_uq/i.test(msg)) {
      throw new Error("This transaction was already approved on another request.");
    }
    throw err;
  }
}

export async function rejectPayment(
  sql: Sql,
  opts: { requestId: string; adminUserId: string; reason: string },
): Promise<void> {
  const req = await getPaymentRequest(sql, opts.requestId, { forUpdate: true });
  if (!req) throw new Error("Payment request not found");
  if (req.status === "APPROVED") throw new Error("Approved payments cannot be rejected.");
  if (req.status === "REJECTED") return;
  const reason = opts.reason.trim();
  if (reason.length < 3) throw new Error("Rejection reason is required.");
  await sql`
    update payment_requests
    set status = 'REJECTED',
        admin_note = ${reason},
        reviewed_by = ${opts.adminUserId},
        reviewed_at = now(),
        updated_at = now()
    where id = ${req.id}
      and status in ('PENDING', 'NEEDS_REVIEW')
  `;
  await notify(
    sql,
    req.user_id,
    "Payment rejected",
    `Your ${PACKAGES[req.package_id].name} payment was not approved. ${reason} You may submit a new payment request.`,
    "payment",
  );
  await audit(sql, opts.adminUserId, "payment.rejected", req.id, reason);
}

export async function markPaymentNeedsReview(
  sql: Sql,
  opts: { requestId: string; adminUserId: string; note: string },
): Promise<void> {
  const req = await getPaymentRequest(sql, opts.requestId, { forUpdate: true });
  if (!req) throw new Error("Payment request not found");
  if (req.status === "APPROVED") throw new Error("Approved payments cannot be marked for review.");
  if (req.status === "REJECTED") throw new Error("Rejected payments cannot be marked for review.");
  const note = opts.note.trim();
  if (note.length < 3) throw new Error("Review note is required.");
  await sql`
    update payment_requests
    set status = 'NEEDS_REVIEW',
        admin_note = ${note},
        reviewed_by = ${opts.adminUserId},
        reviewed_at = now(),
        updated_at = now()
    where id = ${req.id}
      and status in ('PENDING', 'NEEDS_REVIEW')
  `;
  await notify(
    sql,
    req.user_id,
    "Payment needs review",
    note,
    "payment",
  );
  await audit(sql, opts.adminUserId, "payment.needs_review", req.id, note);
}
