import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListTransactions } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { toInt } from "@/lib/money";

export const Route = createFileRoute("/admin/transactions")({ component: Tx });

function Tx() {
  const q = useQuery({ queryKey: ["admin", "tx"], queryFn: () => adminListTransactions() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Transactions" />
      <AdminList
        rows={q.data}
        columns={[
          { key: "id", label: "Tx", render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> },
          { key: "mid", label: "ID", render: (r) => <span className="font-mono text-xs">{r.member_id}</span> },
          { key: "type", label: "Type", render: (r) => r.type },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.amount)) },
          { key: "src", label: "Source", render: (r) => r.source },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Date", render: (r) => formatDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
