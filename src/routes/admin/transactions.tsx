import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListTransactions } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch, FilterChips } from "@/components/admin-filters";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/transactions")({ component: Tx });

function Tx() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "posted" | "HELD" | "RELEASED" | "REVERSED">("all");
  const list = useQuery({ queryKey: ["admin", "tx"], queryFn: () => adminListTransactions() });
  const rows = useMemo(() => {
    let data = list.data ?? [];
    if (status !== "all") data = data.filter((r) => r.status === status);
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => `${r.member_id} ${r.type} ${r.source} ${r.id}`.toLowerCase().includes(needle));
  }, [list.data, q, status]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader title="Transactions" hint="Existing wallet ledger. Available, held, released, and reversed stay visually distinct." />
      <FilterChips
        options={[
          { id: "all", label: "All" },
          { id: "posted", label: "Posted" },
          { id: "HELD", label: "Held" },
          { id: "RELEASED", label: "Released" },
          { id: "REVERSED", label: "Reversed" },
        ]}
        value={status}
        onChange={setStatus}
        labelledBy="Transaction status"
      />
      <AdminSearch value={q} onChange={setQ} label="Search transactions" placeholder="Search Membership ID, type, or source" />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.transactions.title}
        empty={ADMIN_EMPTY.transactions.body}
        caption="Wallet transactions"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.member_id } })}
        columns={[
          { key: "id", label: "Tx", render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> },
          { key: "mid", label: "ID", render: (r) => <span className="font-mono text-xs">{r.member_id}</span> },
          { key: "type", label: "Type", render: (r) => r.type },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.amount)) },
          { key: "src", label: "Source", hideOnMobile: true, render: (r) => r.source },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Date", hideOnMobile: true, render: (r) => formatDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
