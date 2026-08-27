import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { MemberWithdrawalPanel } from "@/components/withdrawal-panel";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/wallet")({ component: Wallet });

function Wallet() {
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const held = q.data.held.reduce((s, h) => s + h.amount, 0);
  const available = q.data.wallets.reduce((s, w) => s + w.available, 0);
  const released = q.data.wallets.reduce((s, w) => s + w.released, 0);
  const reversed = q.data.transactions
    .filter((tx) => tx.status === "REVERSED" || tx.type === "REVERSAL")
    .reduce((s, tx) => s + Math.abs(toInt(tx.amount)), 0);
  const primaryId = q.data.wallets[0]?.memberId ?? null;

  return (
    <div>
      <PageHeader title="Wallet" hint="Held commission is not withdrawable. Only released amounts sit in available balance." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-held-soft">
          <p className="text-xs font-medium uppercase tracking-wider text-held">Held commission</p>
          <div className="mt-2 text-held">
            <Money amount={held} size="lg" />
          </div>
          <p className="mt-2 text-xs text-held">Pending until the level’s member count is complete.</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Available balance</p>
          <div className="mt-2">
            <Money amount={available} size="lg" />
          </div>
          <p className="mt-2 text-xs text-muted">Released to this account and currently available.</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Released earnings</p>
          <div className="mt-2">
            <Money amount={released} size="lg" />
          </div>
          <p className="mt-2 text-xs text-muted">Lifetime full-level releases posted to the ledger.</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Reversed adjustments</p>
          <div className="mt-2">
            <Money amount={reversed} size="lg" />
          </div>
          <p className="mt-2 text-xs text-muted">Clawbacks from reversed joins. Ledger rows are kept.</p>
        </Card>
      </div>

      {q.data.held.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Held by level</h2>
          <div className="space-y-2">
            {q.data.held.map((h) => (
              <Card key={`${h.memberId}-${h.level}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Level {h.level}</p>
                  <p className="font-mono text-xs text-muted">{h.memberId}</p>
                </div>
                <span className="tabular text-sm font-semibold text-held">{formatBdt(h.amount)}</span>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <MemberWithdrawalPanel memberId={primaryId} available={available} />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Transaction history</h2>
        <Link to="/app/transactions" className="text-sm font-medium text-accent">
          Full ledger
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {q.data.transactions.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">
            No wallet releases yet. Commission stays held until a level is complete.
          </Card>
        ) : (
          q.data.transactions.slice(0, 12).map((tx) => (
            <Card key={tx.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tx.source}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {tx.id.slice(0, 8)} · {tx.member_id}
                  {tx.level ? ` · L${tx.level}` : ""}
                  {tx.generation ? ` · G${tx.generation}` : ""}
                </p>
                <p className="text-xs text-muted">{formatDateTime(tx.created_at)}</p>
              </div>
              <div className="text-right">
                <Money amount={toInt(tx.amount)} size="sm" />
                <div className="mt-1">
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
