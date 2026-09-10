import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListCommissions } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { Card } from "@/components/ui/card";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/held")({ component: Held });

function Held() {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["admin", "commissions", "HELD"],
    queryFn: () => adminListCommissions({ data: { status: "HELD" } }),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const total = q.data.reduce((s, r) => s + toInt(r.commission_amount), 0);
  return (
    <div>
      <PageHeader title="Held commissions" hint="Held commission is not withdrawable. Nothing here is in a member wallet yet." />
      <Card className="mb-4" tone="held">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Held liability</p>
        <p className="mt-2 tabular text-xl font-semibold">{formatBdt(total)}</p>
      </Card>
      <AdminList
        rows={q.data}
        emptyTitle={ADMIN_EMPTY.held.title}
        empty={ADMIN_EMPTY.held.body}
        caption="Held commissions"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.beneficiary_id } })}
        columns={[
          { key: "ben", label: "Beneficiary", render: (r) => <span className="font-mono text-xs">{r.beneficiary_id}</span> },
          { key: "src", label: "Source", render: (r) => <span className="font-mono text-xs">{r.source_id}</span> },
          { key: "lv", label: "Level", render: (r) => `L${r.level}` },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.commission_amount)) },
          { key: "date", label: "Held at", hideOnMobile: true, render: (r) => formatDateTime(r.held_at) },
        ]}
      />
    </div>
  );
}
