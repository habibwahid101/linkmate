import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMembershipIdDetail, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { LandModule } from "@/components/land-module";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { IdSwitcher, IdScopedLinks } from "@/components/id-switcher";
import { evaluateLandQualification } from "@/lib/qualification";
import { LEVELS } from "@/lib/rules";
import { parseMemberIdSearch, progressNounShort } from "@/lib/id-workspace";

export const Route = createFileRoute("/app/qualification")({
  validateSearch: parseMemberIdSearch,
  component: Qualification,
});

function Qualification() {
  const { id } = Route.useSearch();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const selected = id ?? ids.data?.[0]?.id;
  const detail = useQuery({
    queryKey: ["id-detail", selected],
    queryFn: () => getMembershipIdDetail({ data: { memberId: selected! } }),
    enabled: Boolean(selected),
  });
  if (ids.isPending || (selected && detail.isPending)) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (!selected) {
    return (
      <div>
        <PageHeader title="Land Qualification" hint="Tracked per Membership ID after membership is issued." />
        <EmptyState
          title="No membership yet"
          body="Activate an ID to track sponsor-3 and Level-9 qualification for the 1 Decimal Land benefit."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }
  if (detail.isError) return <QueryError error={detail.error} retry={() => detail.refetch()} />;
  const d = detail.data!;
  const completedLevels = d.journey.filter((l) => l.status === "RELEASED").length;
  const level9Released = d.journey.some((l) => l.level === 9 && l.status === "RELEASED");
  const land = evaluateLandQualification({
    hasMembership: true,
    directSponsors: d.directs.count,
    completedLevels,
    level9Released,
  });

  return (
    <div>
      <PageHeader
        title="Land Qualification"
        hint={
          ids.data ? (
            <IdSwitcher ids={ids.data} selectedId={d.id} onSelectPath="/app/qualification" />
          ) : (
            `${d.id} · 1 Decimal Land after 3 directs and Level 9.`
          )
        }
      />
      <LandModule q={land} />
      <Card className="mt-4" tone="progress">
        <p className="text-sm font-semibold">Level completion on {d.id}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">
          Status is “Qualified” only when both mandatory conditions are complete on this ID.
        </p>
        <ul className="mt-4 space-y-3">
          {LEVELS.map((rule) => {
            const row = d.journey.find((l) => l.level === rule.level);
            const status = row?.status ?? "LOCKED";
            return (
              <li key={rule.level}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    Level {rule.level} · {progressNounShort(rule.level)}
                  </span>
                  <StatusBadge status={status} />
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={row?.completed_members ?? 0}
                  max={rule.requiredMembers}
                />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-4 text-sm">
        <Link to="/app/levels" search={{ id: d.id }} className="font-medium text-accent">
          Open detailed level progress
        </Link>
      </p>
      <div className="mt-4">
        <IdScopedLinks memberId={d.id} />
      </div>
    </div>
  );
}