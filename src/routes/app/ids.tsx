import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyIds } from "@/lib/server/member";
import { setActiveId } from "@/lib/server/profile";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Money } from "@/components/money";
import { formatDate, packageLabel } from "@/lib/format";
import { getDashboard } from "@/lib/server/member";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ids")({ component: Ids });

function Ids() {
  const qc = useQueryClient();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const activate = useMutation({
    mutationFn: (memberId: string) => setActiveId({ data: { memberId } }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Active ID updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ids.isPending) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (ids.data.length === 0) {
    return (
      <div>
        <PageHeader title="My IDs" hint="IDs are created when you buy a package." />
        <EmptyState
          title="No IDs yet"
          body="Choose a package to issue your first membership ID."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const active = dash.data?.activeId;

  return (
    <div>
      <PageHeader title="My IDs" hint="Switch the active ID to see its level, team, and commission." />
      <div className="grid gap-3 lg:grid-cols-2">
        {ids.data.map((row) => (
          <Card key={row.id} className={row.id === active ? "shadow-[0_0_0_2px_var(--color-accent)]" : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{row.id}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {packageLabel(row.package_id)}
                  {row.is_root ? " · Root" : ""}
                </p>
              </div>
              <StatusBadge status={row.placement_status === "pending_config" ? "pending_config" : row.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Sponsor</dt>
                <dd className="font-mono text-xs">{row.sponsor_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Parent</dt>
                <dd className="font-mono text-xs">{row.parent_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd>{formatDate(row.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Level</dt>
                <dd>Level {row.currentLevel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Held</dt>
                <dd>
                  <Money amount={row.held} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Available</dt>
                <dd>
                  <Money amount={row.available} size="sm" />
                </dd>
              </div>
            </dl>
            {row.placement_status === "pending_config" ? (
              <p className="mt-3 text-xs text-warning">
                Internal placement is configurable. This ID is owned but not yet placed in the generation tree.
              </p>
            ) : null}
            <Button
              className="mt-4 w-full"
              variant={row.id === active ? "secondary" : "primary"}
              disabled={row.id === active || activate.isPending}
              onClick={() => activate.mutate(row.id)}
            >
              {row.id === active ? "Active ID" : "Make active"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
