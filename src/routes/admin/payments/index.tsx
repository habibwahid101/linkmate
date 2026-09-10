import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListPayments, adminPaymentSummary } from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch, FilterChips } from "@/components/admin-filters";
import { Card, type CardTone } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentStatus } from "@/lib/payments";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/payments/")({ component: Queue });

const FILTERS: { id: PaymentStatus | "ALL"; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "NEEDS_REVIEW", label: "Needs review" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
];

function Queue() {
  const nav = useNavigate();
  const [status, setStatus] = useState<PaymentStatus | "ALL">("PENDING");
  const [q, setQ] = useState("");
  const summary = useQuery({ queryKey: ["admin", "pay-summary"], queryFn: () => adminPaymentSummary() });
  const list = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: () =>
      adminListPayments({
        data: { status: status === "ALL" ? undefined : status },
      }),
  });
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((row) => {
      const extra = row.extra ?? {};
      const hay = `${row.display_name} ${row.active_id ?? ""} ${row.transaction_reference ?? ""} ${row.id} ${extra.receivedBy ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list.data, q]);
  if (summary.isPending || list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  const s = summary.data;
  return (
    <div>
      <PageHeader title="Payment requests" hint="Approval activates the package, issues IDs, and runs commissions. Submission does not. Duplicate approval cannot create duplicate IDs." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="held" label="Pending" value={s?.pending ?? 0} />
        <Kpi tone="warning" label="Needs review" value={s?.needsReview ?? 0} />
        <Kpi tone="success" label="Approved today" value={s?.approvedToday ?? 0} />
        <Kpi tone="error" label="Rejected" value={s?.rejected ?? 0} />
      </div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} labelledBy="Payment status" />
      <AdminSearch
        value={q}
        onChange={setQ}
        label="Search payments"
        placeholder="Search user, member ID, transaction, or collector"
      />
      <AdminList
        emptyTitle={ADMIN_EMPTY.payments.title}
        empty={ADMIN_EMPTY.payments.body}
        caption="Payment requests"
        onRow={(r) => nav({ to: "/admin/payments/$id", params: { id: r.id } })}
        rows={rows}
        columns={[
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.expected_amount_bdt)) },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "m", label: "Method", render: (r) => PAYMENT_METHOD_LABEL[r.payment_method as PaymentMethod] },
          { key: "tx", label: "Reference", render: (r) => r.transaction_reference ?? r.extra?.receivedBy ?? "—" },
          { key: "mid", label: "Member ID", hideOnMobile: true, render: (r) => r.active_id ?? "—" },
          { key: "dt", label: "Submitted", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: CardTone }) {
  return (
    <Card tone={tone}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 tabular text-xl font-semibold">{value}</p>
    </Card>
  );
}
