import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Money } from "@/components/money";
import { formatDateTime } from "@/lib/format";
import { toInt } from "@/lib/money";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/app/transactions")({ component: Transactions });

function Transactions() {
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Transactions" hint="Every wallet movement is a ledger entry. Balances are never silently edited." />
      {q.data.transactions.length === 0 ? (
        <EmptyState title="No transactions" body="When a level completes, the full held amount posts here." />
      ) : (
        <div className="space-y-2">
          {q.data.transactions.map((tx) => (
            <Card key={tx.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tx.source}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">{tx.id}</p>
                  <p className="mt-1 text-xs text-muted">
                    {tx.member_id}
                    {tx.related_member_id ? ` · ${tx.related_member_id}` : ""}
                    {tx.level != null ? ` · Level ${tx.level}` : ""}
                    {tx.generation != null ? ` · Gen ${tx.generation}` : ""}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(tx.created_at)}</p>
                </div>
                <div className="text-right">
                  <Money amount={toInt(tx.amount)} size="sm" />
                  <div className="mt-1">
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Commission ledger</h2>
        {q.data.commissions.length === 0 ? (
          <p className="text-sm text-muted">No commission entries yet.</p>
        ) : (
          <div className="space-y-2">
            {q.data.commissions.map((c) => (
              <Card key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Level {c.level} · Gen {c.generation}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {c.beneficiary_id} ← {c.source_id}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(c.held_at)}</p>
                </div>
                <div className="text-right">
                  <Money amount={toInt(c.commission_amount)} size="sm" />
                  <div className="mt-1">
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
