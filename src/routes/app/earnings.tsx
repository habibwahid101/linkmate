import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEarningsByLevel } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { formatBdt } from "@/lib/money";
import { toInt } from "@/lib/money";
import { ordinalGeneration } from "@/lib/rules";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/app/earnings")({ component: Earnings });

function Earnings() {
  const q = useQuery({ queryKey: ["earnings"], queryFn: () => getEarningsByLevel() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  if (q.data.length === 0) {
    return (
      <div>
        <PageHeader title="Earnings" />
        <EmptyState
          title="No commission yet"
          body="Earnings by level appear as your network generates held and released commission."
          action="View team"
          actionTo="/app/team"
        />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Earnings" hint="Held stays pending until the level completes. Released is in your wallet." />
      <div className="space-y-2">
        {q.data.map((row) => (
          <Card key={row.level} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                Level {row.level} · {ordinalGeneration(row.generation)} generation
              </p>
              <p className="mt-1 text-xs text-muted">
                Held {formatBdt(toInt(row.held))} · Released {formatBdt(toInt(row.released))}
              </p>
            </div>
            <p className="tabular text-sm font-semibold">{formatBdt(toInt(row.held) + toInt(row.released))}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
