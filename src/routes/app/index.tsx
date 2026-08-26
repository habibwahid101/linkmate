import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, loadSampleNetwork } from "@/lib/server/member";
import { setActiveId } from "@/lib/server/profile";
import { LevelCard, LevelKpi } from "@/components/level-card";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { formatBdt } from "@/lib/money";
import { PACKAGES } from "@/lib/rules";
import { formatDate, packageLabel } from "@/lib/format";
import { toast } from "sonner";
import type { PackageId } from "@/lib/rules";

export const Route = createFileRoute("/app/")({ component: Home });

function Home() {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const sample = useMutation({
    mutationFn: () => loadSampleNetwork(),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Turbo sample network loaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const activate = useMutation({
    mutationFn: (memberId: string) => setActiveId({ data: { memberId } }),
    onSuccess: () => void qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;
  const d = dash.data;
  const pkg = d.latestPackage ? PACKAGES[d.latestPackage as PackageId] : null;
  const next = d.nextMilestone;

  if (!d.activeId) {
    return (
      <div>
        <PageHeader title={`Hello, ${d.profile.displayName.split(" ")[0]}`} hint="Choose a package to receive your first ID." />
        <EmptyState
          title="No membership yet"
          body="Buy a package to create IDs, or load a Turbo sample to see Level 1 released and Level 2 in progress."
          action="View packages"
          actionTo="/app/packages"
        />
        <Button
          className="mt-4 w-full sm:w-auto"
          variant="outline"
          disabled={sample.isPending}
          onClick={() => sample.mutate()}
        >
          {sample.isPending ? "Loading sample…" : "Load Turbo sample network"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={d.profile.displayName}
        hint={
          d.ids.length > 1 ? (
            <label className="mt-1 flex items-center gap-2 text-sm">
              <span className="text-muted">Active ID</span>
              <select
                className="h-9 min-w-0 max-w-[12rem] rounded-[10px] bg-surface px-2 font-mono text-xs shadow-[0_0_0_1px_var(--color-border)]"
                value={d.activeId ?? ""}
                onChange={(e) => activate.mutate(e.target.value)}
                aria-label="Switch active ID"
              >
                {d.ids.map((id) => (
                  <option key={id.id} value={id.id}>
                    {id.id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span>
              {d.activeId} · {pkg?.name ?? "Member"}
            </span>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <LevelKpi
          label="My package"
          value={<span className="text-xl font-semibold tracking-tight sm:text-2xl">{pkg?.name ?? "—"}</span>}
          hint={pkg ? `${pkg.idCount} IDs` : undefined}
        />
        <LevelKpi
          label="My IDs"
          value={<span className="tabular text-xl font-semibold tracking-tight sm:text-2xl">{d.ids.length}</span>}
          hint={d.activeId}
        />
        <LevelKpi
          label="Current level"
          value={<span className="text-xl font-semibold tracking-tight sm:text-2xl">Level {d.currentLevel}</span>}
          hint={`${d.directSponsors} / 3 direct`}
        />
        <LevelKpi label="Held commission" value={d.idWallet.held} hint="This ID · not withdrawable" />
        <LevelKpi label="Available wallet" value={d.idWallet.available} hint="This ID · released" />
        <LevelKpi
          label="Total earnings"
          value={d.idWallet.released}
          hint={d.wallet.released !== d.idWallet.released ? `Account ${formatBdt(d.wallet.released)}` : "Lifetime released"}
        />
      </div>

      {next ? (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Next milestone</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug sm:text-base">
                Level {next.level} · {next.completed}/{next.required} members
              </p>
            </div>
            <StatusBadge status={next.status} />
          </div>
          <div className="mt-3">
            <ProgressBar value={next.completed} max={next.required} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {next.remaining} remaining · next release {formatBdt(next.nextRelease)}
          </p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Level progress</CardTitle>
            <Link to="/app/levels" className="text-sm font-medium text-accent">
              All levels
            </Link>
          </div>
          <div className="space-y-3">
            {d.levelProgress
              .filter((l) => l.status !== "LOCKED")
              .slice(0, 3)
              .map((row) => (
                <LevelCard key={row.level} row={row} />
              ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Network snapshot</CardTitle>
            <Link to="/app/team" className="text-sm font-medium text-accent">
              Team
            </Link>
          </div>
          <Card>
            <p className="text-sm text-muted">
              {d.generationTotal} generation members · {d.directSponsors} personal sponsors
            </p>
            <div className="mt-4 space-y-3">
              {d.recentMembers.length === 0 ? (
                <p className="text-sm text-muted">Your team will appear here as members join.</p>
              ) : (
                d.recentMembers.map((m) => (
                  <div key={m.member_id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.display_name}</p>
                      <p className="font-mono text-xs text-muted">
                        {m.member_id} · Gen {m.generation}
                      </p>
                    </div>
                    <span className="text-xs text-muted">{packageLabel(m.package_id)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Recent earnings</CardTitle>
              <Link to="/app/wallet" className="text-sm font-medium text-accent">
                Wallet
              </Link>
            </div>
            <Card>
              {d.recentTx.length === 0 ? (
                <p className="text-sm text-muted">Released earnings will show here after a level completes.</p>
              ) : (
                <ul className="space-y-3">
                  {d.recentTx.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tx.source}</p>
                        <p className="text-xs text-muted">{formatDate(tx.created_at)}</p>
                      </div>
                      <Money amount={tx.amount} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
