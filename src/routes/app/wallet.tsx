import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { MemberWithdrawalPanel } from "@/components/withdrawal-panel";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime, packageLabel } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/app/wallet")({ component: Wallet });

function Wallet() {
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const held = q.data.summary.held;
  const available = q.data.summary.available;
  const released = q.data.summary.released;
  const reversed = q.data.transactions
    .filter((tx) => tx.status === "REVERSED" || tx.type === "REVERSAL")
    .reduce((s, tx) => s + Math.abs(toInt(tx.amount)), 0);
  const richest = [...q.data.wallets].sort((a, b) => b.available - a.available)[0];
  const selectedId = withdrawId ?? richest?.memberId ?? null;
  const selectedWallet = q.data.wallets.find((w) => w.memberId === selectedId);

  return (
    <div>
      <PageHeader
        title="Account wallet"
        hint="Available balance is the account total of released amounts. Held commission is not withdrawable. IDs earn; this account uses the balance."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card tone="success">
          <p className="kicker text-accent">Available balance</p>
          <div className="mt-2">
            <Money amount={available} size="lg" className="text-accent" />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">Account-level withdrawable total of released earnings.</p>
        </Card>
        <Card tone="held">
          <p className="kicker text-held">Held commission</p>
          <div className="mt-2">
            <Money amount={held} size="lg" className="text-held" />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">Aggregate held across IDs. Not withdrawable.</p>
        </Card>
        <Card tone="success">
          <p className="kicker text-success">Released earnings</p>
          <div className="mt-2">
            <Money amount={released} size="lg" className="text-success" />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">Lifetime full-level releases posted to the ledger.</p>
        </Card>
        <Card tone="error">
          <p className="text-xs font-medium uppercase tracking-wider text-danger">Reversed adjustments</p>
          <div className="mt-2">
            <Money amount={reversed} size="lg" />
          </div>
          <p className="mt-2 text-xs text-muted">Clawbacks from reversed joins. Ledger rows are kept.</p>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <CardTitle>Earnings by Membership ID</CardTitle>
          <Link to="/app/earnings" className="text-sm font-medium text-accent">
            Earnings
          </Link>
        </div>
        {q.data.wallets.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">No Membership IDs yet. Wallet rows appear after a package is activated.</Card>
        ) : (
          <div className="space-y-2">
            {q.data.wallets.map((w) => (
              <Card key={w.memberId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{w.memberId}</p>
                  <p className="text-xs text-muted">
                    {packageLabel(w.packageId)} · Level {w.currentLevel}
                    {w.progressionStatus === "GRADUATED" ? " · Graduated" : ""}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-sm">
                  <div>
                    <p className="text-[13px] text-held">Held</p>
                    <p className="tabular font-medium text-held">{formatBdt(w.held)}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-success">Released</p>
                    <p className="tabular font-medium text-success">{formatBdt(w.released)}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-accent">Available</p>
                    <p className="tabular font-medium text-accent">{formatBdt(w.available)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {q.data.held.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Held by level (per ID)</h2>
          <div className="space-y-2">
            {q.data.held.map((h) => (
              <Card key={`${h.memberId}-${h.level}`} className="flex items-center justify-between" tone="held">
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

      {q.data.wallets.length > 1 ? (
        <label className="mt-6 flex flex-col gap-1 text-sm">
          <span className="text-muted">Withdraw from released balance of</span>
          <select
            className="h-11 w-full rounded-[12px] bg-surface px-3 font-mono text-xs shadow-[0_0_0_1px_var(--color-border)] sm:max-w-sm"
            value={selectedId ?? ""}
            onChange={(e) => setWithdrawId(e.target.value)}
            aria-label="Membership ID to withdraw from"
          >
            {q.data.wallets.map((w) => (
              <option key={w.memberId} value={w.memberId}>
                {w.memberId} · {formatBdt(w.available)} available
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <MemberWithdrawalPanel memberId={selectedId} available={selectedWallet?.available ?? available} />

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
                  {tx.member_id}
                  {tx.level ? ` · Level ${tx.level}` : ""}
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