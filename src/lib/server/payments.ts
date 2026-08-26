import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, advisoryLock, dbSource } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/server/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertDurableMutations, runtimeFlags } from "@/lib/runtime";
import { PACKAGE_IDS, type PackageId } from "@/lib/rules";
import { PAYMENT_METHODS, PAYMENT_STATUSES, type PaymentMethod, type PaymentStatus } from "@/lib/payments";
import {
  approvePayment,
  assertPaymentOwner,
  getPaymentMethod,
  getPaymentRequest,
  listUserPayments,
  loadPaymentSettings,
  markPaymentNeedsReview,
  rejectPayment,
  savePaymentMethod,
  submitPaymentRequest,
  type PaymentRequestRow,
  type PaymentSettingsRow,
} from "@/lib/payments/engine";

const packageIdSchema = z.enum(PACKAGE_IDS);
const methodSchema = z.enum(PAYMENT_METHODS);

export type PaymentPublic = {
  id: string;
  packageId: PackageId;
  expectedAmountBdt: number;
  submittedAmountBdt: number;
  method: PaymentMethod;
  transactionReference: string | null;
  userNote: string | null;
  extra: Record<string, string>;
  status: PaymentStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  purchaseId: string | null;
  duplicateSuspect: boolean;
};

function toPublic(row: PaymentRequestRow): PaymentPublic {
  return {
    id: row.id,
    packageId: row.package_id,
    expectedAmountBdt: row.expected_amount_bdt,
    submittedAmountBdt: row.submitted_amount_bdt,
    method: row.payment_method,
    transactionReference: row.transaction_reference,
    userNote: row.user_note,
    extra: row.extra,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    purchaseId: row.purchase_id,
    duplicateSuspect: row.duplicate_suspect,
  };
}

function receivingPublic(row: PaymentSettingsRow) {
  return {
    method: row.method,
    enabled: row.enabled,
    number: row.number,
    accountType: row.account_type,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    branch: row.branch,
    routingNumber: row.routing_number,
    swift: row.swift,
    instructions: row.instructions,
  };
}

export const getPaymentMethodsPublic = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await loadPaymentSettings(sql);
    return rows.map(receivingPublic);
  });

export const submitManualPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      packageId: packageIdSchema,
      method: methodSchema,
      submittedAmountBdt: z.number().int().positive(),
      transactionReference: z.string().max(80).optional(),
      userNote: z.string().max(400).optional(),
      referralCode: z.string().max(40).optional(),
      extra: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertDurableMutations((key) => process.env[key], dbSource);
    const flags = runtimeFlags();
    if (!flags.manualPayments) throw new Error("Manual payment is not available.");
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `payment-submit:${context.userId}`);
      await assertRateLimit(tx, `payment-submit:${context.userId}`, 12, 3600);
      const req = await submitPaymentRequest(tx, {
        userId: context.userId,
        packageId: data.packageId,
        method: data.method,
        submittedAmountBdt: data.submittedAmountBdt,
        transactionReference: data.transactionReference,
        userNote: data.userNote,
        extra: data.extra,
        referralCode: data.referralCode,
      });
      return {
        id: req.id,
        status: req.status,
        packageId: req.package_id,
        amount: req.expected_amount_bdt,
        method: req.payment_method,
        transactionReference: req.transaction_reference,
        createdAt: req.created_at,
        duplicateSuspect: req.duplicate_suspect,
      };
    });
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await listUserPayments(sql, context.userId);
    return rows.map(toPublic);
  });

export const getMyPayment = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await getPaymentRequest(sql, data.id);
    return toPublic(assertPaymentOwner(row, context.userId));
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        status: z.enum(PAYMENT_STATUSES).optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const status = data?.status;
    const rows = await sql<{
      id: string;
      user_id: string;
      display_name: string;
      active_id: string | null;
      package_id: string;
      expected_amount_bdt: number;
      submitted_amount_bdt: number;
      payment_method: string;
      transaction_reference: string | null;
      status: string;
      duplicate_suspect: boolean;
      created_at: string;
    }>`
      select r.id, r.user_id, u.display_name, u.active_id, r.package_id,
             r.expected_amount_bdt, r.submitted_amount_bdt, r.payment_method,
             r.transaction_reference, r.status, r.duplicate_suspect, r.created_at
      from payment_requests r
      join app_users u on u.user_id = r.user_id
      order by r.created_at desc
      limit 300
    `;
    return rows.filter((row) => (status ? row.status === status : true));
  });

export const adminPaymentSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const counts = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from payment_requests group by status
    `;
    const approvedToday = await sql<{ n: number }>`
      select count(*)::int as n from payment_requests
      where status = 'APPROVED' and reviewed_at::date = now()::date
    `;
    const map = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    return {
      pending: map.PENDING ?? 0,
      needsReview: map.NEEDS_REVIEW ?? 0,
      approvedToday: approvedToday[0]?.n ?? 0,
      rejected: map.REJECTED ?? 0,
    };
  });

export const adminGetPayment = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const row = await getPaymentRequest(sql, data.id);
    if (!row) throw new Error("Payment request not found");
    const user = await sql<{ display_name: string; email: string | null; active_id: string | null }>`
      select display_name, email, active_id from app_users where user_id = ${row.user_id}
    `;
    const method = await getPaymentMethod(sql, row.payment_method);
    return {
      request: toPublic(row),
      user: user[0] ?? null,
      receiving: method ? receivingPublic(method) : null,
    };
  });

export const adminApprovePayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80), confirm: z.literal(true) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    assertDurableMutations((key) => process.env[key], dbSource);
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `payment-approve:${data.id}`);
      await assertRateLimit(tx, `admin:approve:${context.userId}`, 40, 3600);
      return approvePayment(tx, { requestId: data.id, adminUserId: context.userId });
    });
  });

export const adminRejectPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80), reason: z.string().min(3).max(400), confirm: z.literal(true) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `payment-approve:${data.id}`);
      await rejectPayment(tx, { requestId: data.id, adminUserId: context.userId, reason: data.reason });
      return { ok: true as const };
    });
  });

export const adminNeedsReviewPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(80), note: z.string().min(3).max(400), confirm: z.literal(true) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql.withTransaction(async (tx) => {
      await advisoryLock(tx, `payment-approve:${data.id}`);
      await markPaymentNeedsReview(tx, { requestId: data.id, adminUserId: context.userId, note: data.note });
      return { ok: true as const };
    });
  });

export const adminGetPaymentSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    return loadPaymentSettings(sql);
  });

export const adminSavePaymentSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      method: methodSchema,
      enabled: z.boolean(),
      number: z.string().max(40).optional(),
      accountType: z.string().max(40).optional(),
      bankName: z.string().max(80).optional(),
      accountName: z.string().max(80).optional(),
      accountNumber: z.string().max(40).optional(),
      branch: z.string().max(80).optional(),
      routingNumber: z.string().max(40).optional(),
      swift: z.string().max(40).optional(),
      instructions: z.string().max(800).optional(),
      confirm: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await assertRateLimit(sql, `admin:settings:${context.userId}`, 20, 3600);
    await savePaymentMethod(sql, context.userId, {
      method: data.method,
      enabled: data.enabled,
      number: data.number ?? null,
      account_type: data.accountType ?? null,
      bank_name: data.bankName ?? null,
      account_name: data.accountName ?? null,
      account_number: data.accountNumber ?? null,
      branch: data.branch ?? null,
      routing_number: data.routingNumber ?? null,
      swift: data.swift ?? null,
      instructions: data.instructions ?? "",
    });
    return { ok: true as const };
  });
