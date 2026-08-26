import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { LandModule } from "@/components/land-module";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { evaluateLandQualification } from "@/lib/qualification";
import { LEVELS } from "@/lib/rules";

export const Route = createFileRoute("/app/qualification")({ component: Qualification });

function Qualification() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;
  const d = dash.data;
  if (!d.activeId) {
    return (
      <div>
        <PageHeader title="Land Qualification" hint="Tracked per active ID after membership is issued." />
        <EmptyState
          title="No membership yet"
          body="Activate an ID to track sponsor-3 and Level-9 qualification for the 1 Katha land benefit."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const completedLevels = d.levelProgress.filter((l) => l.status === "RELEASED").length;
  const level9Released = d.levelProgress.some((l) => l.level === 9 && l.status === "RELEASED");
  const land = evaluateLandQualification({
    hasMembership: true,
    directSponsors: d.directSponsors,
    completedLevels,
    level9Released,
  });

  return (
    <div>
      <PageHeader
        title="Land Qualification"
        hint={`${d.activeId} · 1 Katha after sponsor 3 and Level 9, then allocation documents.`}
      />
      <LandModule q={land} />
      <Card className="mt-4">
        <p className="text-sm font-semibold">Level completion</p>
        <p className="mt-1 text-sm text-muted">
          Status is “Qualified” only when both mandatory conditions are complete on this ID.
        </p>
        <ul className="mt-4 space-y-3">
          {LEVELS.map((rule) => {
            const row = d.levelProgress.find((l) => l.level === rule.level);
            const status = row?.status ?? "LOCKED";
            return (
              <li key={rule.level}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Level {rule.level}</span>
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
        <Link to="/app/levels" className="font-medium text-accent">
          Open detailed level progress
        </Link>
      </p>
    </div>
  );
}
