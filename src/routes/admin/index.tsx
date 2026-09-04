import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card, type CardTone } from "@/components/ui/card";
import { Money } from "@/components/money";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { PACKAGES } from "@/lib/rules";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Kpi({ label, children, hint, tone = "default" }: { label: string; children: ReactNode; hint?: string; tone?: CardTone }) {
  return (
    <Card className="min-w-0" tone={tone}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => getAdminOverview() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return (
    <div>
      <PageHeader title="Overview" hint="Live membership, joining value, and commission liability." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Users">{d.totalUsers}</Kpi>
        <Kpi tone="info" label="Active IDs">{d.activeIds}</Kpi>
        <Kpi tone="package" label="Joining value">
          <Money amount={d.joiningValue} size="lg" />
        </Kpi>
        <Kpi tone="held" label="Held commission">
          <Money amount={d.held} size="lg" />
        </Kpi>
        <Kpi tone="success" label="Released">
          <Money amount={d.released} size="lg" />
        </Kpi>
        <Kpi label="Wallet liabilities">
          <Money amount={d.walletLiabilities} size="lg" />
        </Kpi>
        <Kpi tone="warning" label="Pending payments" hint="Awaiting verification">
          <Link to="/admin/payments" className="tabular text-xl font-semibold text-ink">
            {d.pendingPayments}
          </Link>
        </Kpi>
        <Kpi label="Accounts" hint="Includes simulated members">
          {d.totalAccounts}
        </Kpi>
      </div>
      <h2 className="mt-8 text-sm font-semibold">Package distribution</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["builder", "turbo", "super_turbo", "hyper_turbo"] as const).map((id) => {
          const row = d.packages[id];
          return (
            <Card key={id} tone="package">
              <p className="text-sm font-medium">{PACKAGES[id].name}</p>
              <p className="mt-2 tabular text-xl font-semibold">{row?.count ?? 0} sales</p>
              <p className="mt-1 text-xs text-muted">{formatBdt(row?.value ?? 0)}</p>
            </Card>
          );
        })}
      </div>
      <h2 className="mt-8 text-sm font-semibold">Level completions</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-9">
        {d.levels.map((l) => {
          const n = d.completions.find((c) => c.level === l.level)?.n ?? 0;
          return (
            <Card key={l.level} className="p-3 text-center" tone="progress">
              <p className="text-[11px] text-muted">L{l.level}</p>
              <p className="tabular text-lg font-semibold">{n}</p>
            </Card>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent purchases</h2>
        <Link to="/admin/purchases" className="text-sm font-medium text-accent">
          All
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {d.recentPurchases.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">No purchases yet.</Card>
        ) : (
          d.recentPurchases.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{packageLabel(p.package_id)}</p>
                <p className="text-xs text-muted">{formatDate(p.created_at)}</p>
              </div>
              <span className="tabular whitespace-nowrap text-sm font-semibold">{formatBdt(toInt(p.amount_bdt))}</span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
