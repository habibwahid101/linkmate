import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminGetSettings } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";
import { levelRequirementCopy } from "@/lib/id-workspace";

export const Route = createFileRoute("/admin/levels")({ component: Levels });

function Levels() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Levels" hint="Locked rates. An ID earns nothing from placement until it has 3 personal sponsors. After that, placement downline counts 3, then 9, 27, and onward through level 9." />
      <div className="space-y-2">
        {q.data.rules.map((r) => (
          <Card key={r.level} className="flex items-center justify-between gap-3" tone="progress">
            <div>
              <p className="text-sm font-semibold">Level {r.level}</p>
              <p className="text-xs text-muted">
                {levelRequirementCopy(r.level)} · {Number(r.rate) * 100}% · v{r.version} · {r.status}
              </p>
            </div>
            <span className="tabular text-sm font-semibold">{formatBdt(fullLevelCommission(r.level))}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
