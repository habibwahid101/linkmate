import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyPayment } from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDateTime, packageLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/payments/$id")({ component: PaymentStatus });

function PaymentStatus() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["my-payment", id], queryFn: () => getMyPayment({ data: { id } }) });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const p = q.data;
  const pending = p.status === "PENDING" || p.status === "NEEDS_REVIEW";
  return (
    <div>
      <PageHeader title={pending ? "Payment request submitted" : "Payment status"} />
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Status</p>
          <StatusBadge status={p.status} />
        </div>
        <Row label="Package" value={packageLabel(p.packageId)} />
        <Row label="Amount" value={formatBdt(p.expectedAmountBdt)} />
        <Row label="Payment method" value={PAYMENT_METHOD_LABEL[p.method]} />
        <Row label="Submitted at" value={formatDateTime(p.createdAt)} />
        {p.transactionReference ? <Row label="Transaction / reference" value={p.transactionReference} /> : null}
        {p.extra.receivedBy ? <Row label="Paid to" value={p.extra.receivedBy} /> : null}
        {p.extra.transferDate ? <Row label="Transfer date" value={p.extra.transferDate} /> : null}
        {p.extra.senderBank ? <Row label="Sender bank" value={p.extra.senderBank} /> : null}
        {p.userNote ? <Row label="Note" value={p.userNote} /> : null}
        {pending ? (
          <p className="text-sm leading-relaxed text-ink">
            Your payment has been submitted for admin verification. Your package will be activated only after the payment is approved.
          </p>
        ) : null}
        {p.status === "APPROVED" ? (
          <p className="text-sm text-success">This payment is approved and the package is active.</p>
        ) : null}
        {p.status === "REJECTED" ? (
          <p className="text-sm text-danger">{p.adminNote || "This payment was not approved."} You can submit a new payment request.</p>
        ) : null}
        {p.status === "NEEDS_REVIEW" && p.adminNote ? <p className="text-sm text-muted">{p.adminNote}</p> : null}
      </Card>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to="/app/payments" className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}>
          View payment status
        </Link>
        <Link to="/app" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
          Back to dashboard
        </Link>
      </div>
      {p.status === "REJECTED" ? (
        <p className="mt-4 text-center text-sm">
          <Link to="/app/packages" className="font-medium text-accent">
            Submit a new payment
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="break-all text-right text-sm font-medium">{value}</span>
    </div>
  );
}
