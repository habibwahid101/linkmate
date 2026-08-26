import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListPurchases } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { toInt } from "@/lib/money";

export const Route = createFileRoute("/admin/purchases")({ component: Purchases });

function Purchases() {
  const q = useQuery({ queryKey: ["admin", "purchases"], queryFn: () => adminListPurchases() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Purchases" />
      <AdminList
        rows={q.data}
        columns={[
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "who", label: "Member", render: (r) => r.display_name },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.amount_bdt)) },
          { key: "ids", label: "IDs", render: (r) => r.id_count },
          { key: "root", label: "Root", render: (r) => <span className="font-mono text-xs">{r.root_id ?? "—"}</span> },
          { key: "st", label: "Payment", render: (r) => <StatusBadge status={r.payment_status} /> },
          { key: "date", label: "Date", render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
