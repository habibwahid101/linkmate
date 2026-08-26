import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyPayments } from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";

export const Route = createFileRoute("/app/payments/")({ component: History });

function History() {
  const q = useQuery({ queryKey: ["my-payments"], queryFn: () => listMyPayments() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="My payments" hint="A submitted request is not an approved package." />
      {q.data.length === 0 ? (
        <EmptyState title="No payments yet" body="Select a package to submit a manual payment for admin verification." action="View packages" actionTo="/app/packages" />
      ) : (
        <div className="space-y-2">
          {q.data.map((p) => (
            <Link key={p.id} to="/app/payments/$id" params={{ id: p.id }} className="block">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{packageLabel(p.packageId)}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatBdt(p.expectedAmountBdt)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">{p.transactionReference || p.id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted">{formatDate(p.createdAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.adminNote && (p.status === "REJECTED" || p.status === "NEEDS_REVIEW") ? (
                  <p className="mt-3 text-sm text-muted">{p.adminNote}</p>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
