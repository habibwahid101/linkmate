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
import { formatDate, formatDateTime, packageLabel } from "@/lib/format";
import { PACKAGES } from "@/lib/rules";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Kpi({
  label,
  children,
  hint,
  tone = "default",
  to,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  tone?: CardTone;
  to?: "/admin/payments" | "/admin/withdrawals" | "/admin/qualification" | "/admin/users" | "/admin/ids" | "/admin/held" | "/admin/wallets";
}) {
  const inner = (
    <Card className="min-w-0" tone={tone}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
  if (!to) return inner;
  return (
    <Link to={to} className="block min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {inner}
    </Link>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => getAdminOverview() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const attention = d.pendingPayments + d.needsReviewPayments + d.pendingWithdrawals;
  return (
    <div>
      <PageHeader
        title="Overview"
        hint="Operational command center. Pending work is first. Financial figures come from the existing ledger."
      />

      <h2 className="text-sm font-semibold">Needs attention</h2>
      <p className="mt-1 text-sm text-muted">
        {attention === 0
          ? "No payment or withdrawal queues are waiting."
          : `${attention} item${attention === 1 ? "" : "s"} waiting for an administrator.`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="held" label="Pending payments" hint="Awaiting verification" to="/admin/payments">
          <span className="tabular text-xl font-semibold">{d.pendingPayments}</span>
        </Kpi>
        <Kpi tone="warning" label="Needs review" hint="Flagged for a second look" to="/admin/payments">
          <span className="tabular text-xl font-semibold">{d.needsReviewPayments}</span>
        </Kpi>
        <Kpi tone="held" label="Pending withdrawals" hint="Reserve / pay / reject" to="/admin/withdrawals">
          <span className="tabular text-xl font-semibold">{d.pendingWithdrawals}</span>
        </Kpi>
        <Kpi tone="success" label="Qualified land IDs" hint="Qualification ≠ transfer" to="/admin/qualification">
          <span className="tabular text-xl font-semibold">{d.qualifiedLand}</span>
        </Kpi>
      </div>

      <h2 className="mt-8 text-sm font-semibold">Membership</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Members" to="/admin/users">{d.totalUsers}</Kpi>
        <Kpi tone="info" label="Active Membership IDs" to="/admin/ids">
          {d.activeIds}
        </Kpi>
        <Kpi tone="package" label="Joining value">
          <Money amount={d.joiningValue} size="lg" />
        </Kpi>
        <Kpi label="Accounts" hint="Includes simulated members">
          {d.totalAccounts}
        </Kpi>
      </div>

      <h2 className="mt-8 text-sm font-semibold">Ledger</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="available" label="Available" hint="Withdrawable when released" to="/admin/wallets">
          <Money amount={d.available} size="lg" />
        </Kpi>
        <Kpi tone="held" label="Held" hint="Not withdrawable" to="/admin/held">
          <Money amount={d.held} size="lg" />
        </Kpi>
        <Kpi tone="success" label="Released" hint="Posted to wallets">
          <Money amount={d.released} size="lg" />
        </Kpi>
        <Kpi tone="error" label="Reversed">
          <Money amount={d.reversed} size="lg" />
        </Kpi>
      </div>

      <h2 className="mt-8 text-sm font-semibold">Package purchases</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["builder", "turbo", "super_turbo", "hyper_turbo"] as const).map((id) => {
          const row = d.packages[id];
          const tone = id === "builder" ? "package" : id === "turbo" ? "info" : id === "super_turbo" ? "progress" : "available";
          return (
            <Card key={id} tone={tone}>
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
          <EmptyState title="No purchases yet." body="Approved payments will create package purchases and Membership IDs." />
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

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <Link to="/admin/audit" className="text-sm font-medium text-accent">
          Audit
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {d.recentAudit.length === 0 ? (
          <EmptyState title="No admin activity yet." body="Payment review, activation, and withdrawal processing are recorded as they happen." />
        ) : (
          d.recentAudit.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted">
                  {a.entity_type} {a.entity_id ?? ""}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(a.created_at)}</span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
