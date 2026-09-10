import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminGetMemberId } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { ProgressBar } from "@/components/progress-bar";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, formatDateTime, packageLabel } from "@/lib/format";
import { levelRequirementCopy, originLabel, progressFraction } from "@/lib/id-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ids/$memberId")({ component: IdDetail });

function IdDetail() {
  const { memberId } = Route.useParams();
  const q = useQuery({
    queryKey: ["admin", "id", memberId],
    queryFn: () => adminGetMemberId({ data: { memberId } }),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const land = d.qualification;
  return (
    <div>
      <PageHeader
        title={d.id}
        hint="Read-only operational inspection. Sponsor, placement, level, and commissions are engine-owned."
      />
      <Card className="space-y-3" tone="info">
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm font-semibold">{d.id}</p>
          <StatusBadge status={d.status} />
        </div>
        <Row label="Account" value={d.owner.displayName} />
        <Row label="Email" value={d.owner.email ?? "—"} />
        <Row label="Package" value={packageLabel(d.package_id)} />
        <Row label="Origin" value={originLabel(d)} />
        <Row label="Referral code" value={d.referral_code ?? "—"} />
        <Row label="Sponsor" value={d.sponsor_id ?? "—"} />
        <Row label="Placement parent" value={d.parent_id ?? "—"} />
        <Row label="Placement" value={d.placement_status} />
        <Row label="Current level" value={`Level ${d.current_level}`} />
        <Row label="Created" value={formatDate(d.created_at)} />
      </Card>
      <Link
        to="/admin/users/$userId"
        params={{ userId: d.owner.userId }}
        className={cn(buttonVariants({ variant: "ghost" }), "mt-2")}
      >
        Open account
      </Link>

      <h2 className="mt-8 text-sm font-semibold">Network</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Card tone="info">
          <p className="text-xs uppercase tracking-wider text-muted">Direct IDs</p>
          <p className="mt-2 tabular text-xl font-semibold">{d.network.directIds}</p>
        </Card>
        <Card tone="progress">
          <p className="text-xs uppercase tracking-wider text-muted">Downline IDs</p>
          <p className="mt-2 tabular text-xl font-semibold">{d.network.downlineIds}</p>
        </Card>
        <Card tone="progress">
          <p className="text-xs uppercase tracking-wider text-muted">Network Depth</p>
          <p className="mt-2 tabular text-xl font-semibold">{d.network.networkDepth}</p>
        </Card>
      </div>

      <h2 className="mt-8 text-sm font-semibold">Level progress</h2>
      <Card className="mt-3" tone="progress">
        <p className="text-sm font-medium">
          Level {d.currentProgress.level} · {progressFraction(d.currentProgress)} {levelRequirementCopy(d.currentProgress.level)}
        </p>
        <ProgressBar
          className="mt-3"
          value={d.currentProgress.completed}
          max={d.currentProgress.required}
          tone="progress"
        />
      </Card>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-9">
        {d.journey.map((p) => (
          <Card key={p.level} className="p-3 text-center" tone={p.status === "RELEASED" ? "success" : "progress"}>
            <p className="text-[11px] text-muted">L{p.level}</p>
            <p className="tabular text-sm font-semibold">
              {p.completed_members}/{p.required_members}
            </p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Earnings</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Card tone="available">
          <p className="text-xs uppercase tracking-wider text-muted">Available</p>
          <Money className="mt-2" amount={d.wallet.available} size="lg" />
        </Card>
        <Card tone="held">
          <p className="text-xs uppercase tracking-wider text-muted">Held</p>
          <Money className="mt-2" amount={d.wallet.held} size="lg" />
        </Card>
        <Card tone="success">
          <p className="text-xs uppercase tracking-wider text-muted">Released</p>
          <Money className="mt-2" amount={d.wallet.released} size="lg" />
        </Card>
      </div>

      <h2 className="mt-8 text-sm font-semibold">1 Decimal Land</h2>
      <Card className="mt-3" tone={land.qualified ? "success" : "held"}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Qualification state</p>
          <Badge tone={land.qualified ? "success" : "held"}>{land.status}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Membership</dt>
            <dd className="mt-0.5">{land.hasMembership ? "Active" : "None"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Direct IDs</dt>
            <dd className="mt-0.5 tabular">
              {land.sponsorProgress} / {land.sponsorRequired}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Completed levels</dt>
            <dd className="mt-0.5 tabular">
              {land.completedLevels} / {land.levelsRequired}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Level 9</dt>
            <dd className="mt-0.5">{land.level9Released ? "Complete" : "Pending"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          Qualification is not legal ownership, allocation, or transfer. Documentation and transfer status are not persisted in this batch.
        </p>
      </Card>

      <h2 className="mt-8 text-sm font-semibold">Direct IDs</h2>
      <div className="mt-3 space-y-2">
        {d.directs.members.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">No Direct IDs yet.</Card>
        ) : (
          d.directs.members.map((m) => (
            <Link key={m.member_id} to="/admin/ids/$memberId" params={{ memberId: m.member_id }} className="block">
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{m.member_id}</p>
                  <p className="text-xs text-muted">
                    {m.display_name} · {packageLabel(m.package_id)}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </Card>
            </Link>
          ))
        )}
        {d.directs.hasMore ? <p className="text-xs text-muted">List capped. Use Network for more.</p> : null}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Recent ledger</h2>
      <div className="mt-3 space-y-2">
        {d.recentTx.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">No wallet transactions on this ID.</Card>
        ) : (
          d.recentTx.map((tx) => (
            <Card key={tx.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{tx.type}</p>
                <p className="text-xs text-muted">{formatDateTime(tx.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-semibold">{formatBdt(toInt(tx.amount))}</p>
                <StatusBadge status={tx.status} />
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/admin/ids" className={cn(buttonVariants({ variant: "ghost" }))}>
          Back to IDs
        </Link>
        <Link to="/admin/network" className={cn(buttonVariants({ variant: "outline" }))}>
          Inspect network
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[60%] break-all text-right text-sm font-medium">{value}</span>
    </div>
  );
}
