import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getLevels, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { LevelCard } from "@/components/level-card";
import { IdSwitcher, IdScopedLinks } from "@/components/id-switcher";
import { parseMemberIdSearch, isGraduated } from "@/lib/id-workspace";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/app/levels")({
  validateSearch: parseMemberIdSearch,
  component: Levels,
});

function Levels() {
  const { id } = Route.useSearch();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const selected = id ?? ids.data?.[0]?.id;
  const q = useQuery({
    queryKey: ["levels", selected],
    queryFn: () => getLevels({ data: selected ? { memberId: selected } : {} }),
    enabled: Boolean(selected) || (ids.isSuccess && (ids.data?.length ?? 0) === 0),
  });
  if (ids.isPending || q.isPending) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.activeId) {
    return (
      <div>
        <PageHeader title="Level progress" />
        <EmptyState
          title="No levels yet"
          body="Level progress appears after you have a membership ID. Each ID has its own L1–L9 journey."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }
  const graduated = q.data.meta ? isGraduated({ progression_status: q.data.meta.progressionStatus }) : false;
  return (
    <div>
      <PageHeader
        title="Level progress"
        hint={ids.data ? <IdSwitcher ids={ids.data} selectedId={q.data.activeId} onSelectPath="/app/levels" /> : q.data.activeId}
      />
      {graduated ? (
        <Card className="mb-4" tone="success">
          <p className="text-sm font-semibold">Graduated · Level journey complete</p>
          <p className="mt-1 text-sm text-muted">This ID finished Level 9. There is no Level 10.</p>
        </Card>
      ) : (
        <p className="mb-4 text-sm text-muted">
          Level 1 needs 3 direct sponsored IDs. Levels 2–9 need eligible downline IDs. Generation depth is not a level requirement.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {q.data.levels.map((row) => (
          <LevelCard key={row.level} row={row} />
        ))}
      </div>
      <div className="mt-6">
        <IdScopedLinks memberId={q.data.activeId} />
      </div>
    </div>
  );
}