import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminReports } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { formatBdt } from "@/lib/money";
import { packageLabel } from "@/lib/format";
import { toInt } from "@/lib/money";

export const Route = createFileRoute("/admin/reports")({ component: Reports });

function Reports() {
  const q = useQuery({ queryKey: ["admin", "reports"], queryFn: () => adminReports() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const liab = q.data.liability;
  return (
    <div>
      <PageHeader title="Reports" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Held liability</p>
          <p className="mt-2 tabular text-xl font-semibold">{formatBdt(toInt(liab?.held))}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Released</p>
          <p className="mt-2 tabular text-xl font-semibold">{formatBdt(toInt(liab?.released))}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Available wallets</p>
          <p className="mt-2 tabular text-xl font-semibold">{formatBdt(toInt(liab?.available))}</p>
        </Card>
      </div>
      <h2 className="mt-8 text-sm font-semibold">Package sales</h2>
      <div className="mt-3 space-y-2">
        {q.data.sales.map((s) => (
          <Card key={s.package_id} className="flex justify-between">
            <span className="text-sm">{packageLabel(s.package_id)}</span>
            <span className="tabular text-sm font-medium">
              {s.n} · {formatBdt(toInt(s.value))}
            </span>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 text-sm font-semibold">User growth</h2>
      <div className="mt-3 space-y-1">
        {q.data.growth.map((g) => (
          <div key={g.day} className="flex justify-between text-sm">
            <span className="text-muted">{g.day}</span>
            <span className="tabular">{g.n}</span>
          </div>
        ))}
      </div>
      <h2 className="mt-8 text-sm font-semibold">ID creation</h2>
      <div className="mt-3 space-y-1">
        {q.data.idGrowth.map((g) => (
          <div key={g.day} className="flex justify-between text-sm">
            <span className="text-muted">{g.day}</span>
            <span className="tabular">{g.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
