import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEarningsByLevel } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card, CardTitle } from "@/components/ui/card";
import { formatBdt } from "@/lib/money";
import { toInt } from "@/lib/money";
import { EmptyState } from "@/components/empty-state";
import { parseMemberIdSearch } from "@/lib/id-workspace";
import { packageLabel } from "@/lib/format";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/earnings")({
  validateSearch: parseMemberIdSearch,
  component: Earnings,
});

function Earnings() {
  const { id } = Route.useSearch();
  const q = useQuery({ queryKey: ["earnings"], queryFn: () => getEarningsByLevel() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const empty = q.data.byId.every((row) => row.held === 0 && row.released === 0) && q.data.byLevel.length === 0;
  if (empty) {
    return (
      <div>
        <PageHeader title="Earnings" hint="Account totals plus earnings attributed to each Membership ID." />
        <EmptyState
          title="No commission yet"
          body="Earnings appear as your IDs generate held and released commission. Each ID keeps its own attribution."
          action="My Membership IDs"
          actionTo="/app/ids"
        />
      </div>
    );
  }
  const focused = id ? q.data.byId.find((row) => row.memberId === id) : null;
  return (
    <div>
      <PageHeader
        title="Earnings"
        hint="Held stays pending until the level completes on that ID. Released is in the account wallet."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card tone="held">
          <p className="kicker text-held">Account held</p>
          <p className="mt-2 tabular text-xl font-semibold text-held">{formatBdt(q.data.summary.held)}</p>
        </Card>
        <Card tone="success">
          <p className="kicker text-success">Account released</p>
          <p className="mt-2 tabular text-xl font-semibold text-success">{formatBdt(q.data.summary.released)}</p>
        </Card>
        <Card tone="success">
          <p className="kicker text-accent">Account available</p>
          <p className="mt-2 tabular text-xl font-semibold text-accent">{formatBdt(q.data.summary.available)}</p>
        </Card>
      </div>

      {focused ? (
        <Card className="mt-4" tone="info">
          <p className="text-xs uppercase tracking-wider text-muted">Selected ID</p>
          <p className="mt-1 font-mono text-sm font-semibold">{focused.memberId}</p>
          <p className="mt-2 text-sm">
            Held {formatBdt(focused.held)} · Released {formatBdt(focused.released)}
          </p>
          <Link to="/app/ids/$memberId" params={{ memberId: focused.memberId }} className="mt-2 inline-block text-sm font-medium text-accent">
            Open this ID’s dashboard
          </Link>
        </Card>
      ) : null}

      <div className="mt-6">
        <CardTitle>Earnings by Membership ID</CardTitle>
        <div className="mt-3 space-y-2">
          {q.data.byId.map((row) => (
            <Link
              key={row.memberId}
              to="/app/ids/$memberId"
              params={{ memberId: row.memberId }}
              className="block"
            >
              <Card
                className={cn(
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                  id === row.memberId && "shadow-[0_0_0_2px_var(--color-accent)]",
                )}
                tone="held"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{row.memberId}</p>
                  <p className="text-xs text-muted">
                    {packageLabel(row.packageId)} · Level {row.currentLevel}
                    {row.progressionStatus === "GRADUATED" ? " · Graduated" : ""}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="tabular">
                    Held {formatBdt(toInt(row.held))} · Released {formatBdt(toInt(row.released))}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {q.data.byLevel.length > 0 ? (
        <div className="mt-6">
          <CardTitle>Account by level</CardTitle>
          <p className="mt-1 text-sm text-muted">Aggregated across every owned ID. Open an ID for attribution.</p>
          <div className="mt-3 space-y-2">
            {q.data.byLevel.map((row) => (
              <Card key={row.level} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Level {row.level}</p>
                  <p className="mt-1 text-xs text-muted">
                    Held {formatBdt(toInt(row.held))} · Released {formatBdt(toInt(row.released))}
                  </p>
                </div>
                <Money amount={toInt(row.held) + toInt(row.released)} size="sm" />
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}