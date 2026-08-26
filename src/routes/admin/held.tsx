import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListCommissions } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { toInt } from "@/lib/money";

export const Route = createFileRoute("/admin/held")({ component: Held });

function Held() {
  const q = useQuery({
    queryKey: ["admin", "commissions", "HELD"],
    queryFn: () => adminListCommissions({ data: { status: "HELD" } }),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const total = q.data.reduce((s, r) => s + toInt(r.commission_amount), 0);
  return (
    <div>
      <PageHeader title="Held commissions" hint={`Liability ${formatBdt(total)}. Nothing here is in a member wallet yet.`} />
      <AdminList
        rows={q.data}
        empty="No held commission."
        columns={[
          { key: "ben", label: "Beneficiary", render: (r) => <span className="font-mono text-xs">{r.beneficiary_id}</span> },
          { key: "src", label: "Source", render: (r) => <span className="font-mono text-xs">{r.source_id}</span> },
          { key: "lv", label: "Level", render: (r) => `L${r.level}` },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.commission_amount)) },
          { key: "date", label: "Held at", render: (r) => formatDateTime(r.held_at) },
        ]}
      />
    </div>
  );
}
