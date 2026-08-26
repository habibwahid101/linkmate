import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getLevels } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { LevelCard } from "@/components/level-card";

export const Route = createFileRoute("/app/levels")({ component: Levels });

function Levels() {
  const q = useQuery({ queryKey: ["levels"], queryFn: () => getLevels() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  if (!q.data.activeId) {
    return (
      <div>
        <PageHeader title="Level progress" />
        <EmptyState
          title="No levels yet"
          body="Level progress appears after you have a membership ID."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Level progress" hint={`Tracked on ${q.data.activeId}. Held until the full member count is met.`} />
      <div className="grid gap-3 lg:grid-cols-2">
        {q.data.levels.map((row) => (
          <LevelCard key={row.level} row={row} />
        ))}
      </div>
    </div>
  );
}
