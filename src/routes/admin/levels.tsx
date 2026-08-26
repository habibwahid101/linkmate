import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminGetSettings } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";

export const Route = createFileRoute("/admin/levels")({ component: Levels });

function Levels() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Levels" hint="Locked defaults. Rates and required counts are versioned in commission_rules." />
      <div className="space-y-2">
        {q.data.rules.map((r) => (
          <Card key={r.level} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                Level {r.level} · {r.generation_label} generation
              </p>
              <p className="text-xs text-muted">
                {r.required_member_count} members · {Number(r.rate) * 100}% · v{r.version} · {r.status}
              </p>
            </div>
            <span className="tabular text-sm font-semibold">{formatBdt(fullLevelCommission(r.level))}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
