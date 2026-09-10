import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListWithdrawals, adminWithdrawalSummary } from "@/lib/server/withdrawals";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch, FilterChips } from "@/components/admin-filters";
import { Card, type CardTone } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";
import type { WithdrawalStatus } from "@/lib/server/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/")({ component: Queue });

const FILTERS: { id: WithdrawalStatus | "ALL"; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "PROCESSING", label: "Processing" },
  { id: "PAID", label: "Paid" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
];

function Queue() {
  const nav = useNavigate();
  const [status, setStatus] = useState<WithdrawalStatus | "ALL">("PENDING");
  const [q, setQ] = useState("");
  const summary = useQuery({ queryKey: ["admin", "wd-summary"], queryFn: () => adminWithdrawalSummary() });
  const list = useQuery({
    queryKey: ["admin", "withdrawals", status],
    queryFn: () =>
      adminListWithdrawals({
        data: { status: status === "ALL" ? undefined : status },
      }),
  });
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((row) => {
      const hay = `${row.display_name} ${row.email ?? ""} ${row.member_id} ${row.id} ${row.payout_method}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list.data, q]);
  if (summary.isPending || list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  const s = summary.data;
  return (
    <div>
      <PageHeader
        title="Withdrawals"
        hint="Minimum BDT 500. Fee is 5% of the requested amount. Held commission cannot be withdrawn. Marking paid is irreversible."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="held" label="Open queue" value={s?.pending ?? 0} />
        <Kpi tone="warning" label="Ready to pay" value={s?.awaitingPay ?? 0} />
        <Kpi tone="success" label="Paid" value={s?.paid ?? 0} />
        <Kpi tone="error" label="Rejected" value={s?.rejected ?? 0} />
      </div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} labelledBy="Withdrawal status" />
      <AdminSearch
        value={q}
        onChange={setQ}
        label="Search withdrawals"
        placeholder="Search member, Membership ID, or method"
      />
      <AdminList
        emptyTitle={ADMIN_EMPTY.withdrawals.title}
        empty={ADMIN_EMPTY.withdrawals.body}
        caption="Withdrawal requests"
        onRow={(r) => nav({ to: "/admin/withdrawals/$id", params: { id: r.id } })}
        rows={rows}
        columns={[
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "id", label: "Membership ID", render: (r) => <span className="font-mono text-xs">{r.member_id}</span> },
          { key: "amt", label: "Requested", render: (r) => formatBdt(toInt(r.amount_bdt)) },
          { key: "fee", label: "Fee", render: (r) => formatBdt(toInt(r.fee_bdt)) },
          { key: "net", label: "Net payout", render: (r) => formatBdt(toInt(r.amount_bdt) - toInt(r.fee_bdt)) },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "m", label: "Method", hideOnMobile: true, render: (r) => r.payout_method },
          { key: "dt", label: "Requested", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
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
