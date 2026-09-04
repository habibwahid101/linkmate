import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/server/member";
import { listMyPayments } from "@/lib/server/payments";
import { PACKAGE_LIST } from "@/lib/rules";
import { PackageCard } from "@/components/package-card";
import { QualificationReminder } from "@/components/qualification-reminder";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/packages")({ component: Packages });

function Packages() {
  const nav = useNavigate();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const pays = useQuery({ queryKey: ["my-payments"], queryFn: () => listMyPayments() });

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;

  const current = dash.data.latestPackage;
  const manual = dash.data.flags.manualPayments;
  const pending = pays.data?.filter((p) => p.status === "PENDING" || p.status === "NEEDS_REVIEW") ?? [];

  return (
    <div>
      <PageHeader
        title="Packages"
        hint="Pay by bKash, Nagad, Bank, or Cash. Membership IDs are issued only after an administrator verifies the payment."
      />
      <div className="mb-4">
        <QualificationReminder />
      </div>
      {manual ? (
        <p className="mb-4 rounded-2xl bg-surface-info px-4 py-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-border-info)]">
          Submitting a payment does not activate your package. Activation happens only after admin approval.
        </p>
      ) : (
        <p className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Purchasing is not open yet.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {PACKAGE_LIST.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            current={current === pkg.id}
            cta={!manual ? "Unavailable" : current === pkg.id ? "Buy again" : "Select Package"}
            onSelect={
              manual
                ? () => nav({ to: "/app/pay", search: { pkg: pkg.id } as never })
                : undefined
            }
          />
        ))}
      </div>
      {pending.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Awaiting verification</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <Link key={p.id} to="/app/payments/$id" params={{ id: p.id }} className="block">
                <Card className="flex items-center justify-between gap-3" tone="held">
                  <div>
                    <p className="font-medium">{PACKAGE_LIST.find((x) => x.id === p.packageId)?.name}</p>
                    <p className="text-sm text-muted">
                      {formatBdt(p.expectedAmountBdt)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod]} · {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-6 text-center text-sm">
        <Link to="/app/payments" className="font-medium text-accent">
          Payment history
        </Link>
      </p>
    </div>
  );
}
