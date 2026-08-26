import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListPayments, adminPaymentSummary } from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentStatus } from "@/lib/payments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments/")({ component: Queue });

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
      const hay = `${row.display_name} ${row.active_id ?? ""} ${row.transaction_reference ?? ""} ${row.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list.data, q]);
  if (summary.isPending || list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  const s = summary.data;
  return (
    <div>
      <PageHeader title="Payment requests" hint="Approval activates the package, issues IDs, and runs commissions. Submission does not." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pending" value={s?.pending ?? 0} />
        <Kpi label="Needs review" value={s?.needsReview ?? 0} />
        <Kpi label="Approved today" value={s?.approvedToday ?? 0} />
        <Kpi label="Rejected" value={s?.rejected ?? 0} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["PENDING", "NEEDS_REVIEW", "APPROVED", "REJECTED", "ALL"] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatus(st)}
            className={cn(
              "h-9 rounded-full px-3 text-sm",
              status === st ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            {st === "ALL" ? "All" : st.replace("_", " ")}
          </button>
        ))}
      </div>
      <Input
        className="mb-4"
        placeholder="Search user, member ID, or transaction ID"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <AdminList
        empty="No payment requests in this filter."
        onRow={(r) => nav({ to: "/admin/payments/$id", params: { id: r.id } })}
        rows={rows}
        columns={[
          { key: "who", label: "User", render: (r) => r.display_name },
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.expected_amount_bdt)) },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "m", label: "Method", render: (r) => PAYMENT_METHOD_LABEL[r.payment_method as PaymentMethod] },
          { key: "tx", label: "Reference", render: (r) => r.transaction_reference ?? "—" },
          { key: "mid", label: "Member ID", hideOnMobile: true, render: (r) => r.active_id ?? "—" },
          { key: "dt", label: "Submitted", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 tabular text-xl font-semibold">{value}</p>
    </Card>
  );
}
