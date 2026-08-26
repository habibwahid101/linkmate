import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminApprovePayment,
  adminGetPayment,
  adminNeedsReviewPayment,
  adminRejectPayment,
} from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDateTime, packageLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { toast } from "sonner";
import { publicErrorMessage } from "@/lib/public-error";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "payment", id], queryFn: () => adminGetPayment({ data: { id } }) });
  const [mode, setMode] = useState<"approve" | "reject" | "review" | null>(null);
  const [reason, setReason] = useState("");

  const act = useMutation({
    mutationFn: async () => {
      if (mode === "approve") return adminApprovePayment({ data: { id, confirm: true } });
      if (mode === "reject") return adminRejectPayment({ data: { id, reason, confirm: true } });
      return adminNeedsReviewPayment({ data: { id, note: reason, confirm: true } });
    },
    onSuccess: () => {
      toast.success(mode === "approve" ? "Payment approved and package activated." : "Payment updated.");
      setMode(null);
      setReason("");
      void qc.invalidateQueries();
      if (mode === "approve") void nav({ to: "/admin/payments" });
    },
    onError: (e) => toast.error(publicErrorMessage(e)),
  });

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const { request: p, user, receiving } = q.data;
  const open = p.status === "PENDING" || p.status === "NEEDS_REVIEW";

  return (
    <div>
      <PageHeader title="Review payment" hint="Approval is irreversible for this request and issues IDs once." />
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Status</p>
          <StatusBadge status={p.status} />
        </div>
        {p.duplicateSuspect ? <p className="text-sm text-warning">Possible duplicate transaction reference.</p> : null}
        <Row label="User" value={user?.display_name ?? "—"} />
        <Row label="Member ID" value={user?.active_id ?? "—"} />
        <Row label="Package" value={packageLabel(p.packageId)} />
        <Row label="Expected amount" value={formatBdt(p.expectedAmountBdt)} />
        <Row label="Submitted amount" value={formatBdt(p.submittedAmountBdt)} />
        <Row label="Method" value={PAYMENT_METHOD_LABEL[p.method]} />
        <Row label="Transaction / reference" value={p.transactionReference ?? "—"} />
        <Row label="Submitted" value={formatDateTime(p.createdAt)} />
        {p.extra.receivedBy ? <Row label="Paid to" value={p.extra.receivedBy} /> : null}
        {p.extra.transferDate ? <Row label="Transfer date" value={p.extra.transferDate} /> : null}
        {p.extra.senderBank ? <Row label="Sender bank" value={p.extra.senderBank} /> : null}
        {p.userNote ? <Row label="User note" value={p.userNote} /> : null}
        {p.adminNote ? <Row label="Admin note" value={p.adminNote} /> : null}
      </Card>
      {receiving ? (
        <Card className="mt-3 space-y-2">
          <p className="text-sm font-medium">Configured receiving account</p>
          {receiving.number ? <Row label="Number" value={receiving.number} /> : null}
          {receiving.bankName ? <Row label="Bank" value={receiving.bankName} /> : null}
          {receiving.accountName ? <Row label="Account name" value={receiving.accountName} /> : null}
          {receiving.accountNumber ? <Row label="Account number" value={receiving.accountNumber} /> : null}
          {receiving.branch ? <Row label="Branch" value={receiving.branch} /> : null}
        </Card>
      ) : null}
      {open ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button onClick={() => setMode("approve")}>Approve</Button>
          <Button variant="secondary" onClick={() => { setMode("review"); setReason(""); }}>Needs review</Button>
          <Button variant="danger" onClick={() => { setMode("reject"); setReason(""); }}>Reject</Button>
        </div>
      ) : null}
      <Link to="/admin/payments" className={cn(buttonVariants({ variant: "ghost" }), "mt-4")}>
        Back to queue
      </Link>

      <Modal
        open={mode !== null}
        onClose={() => !act.isPending && setMode(null)}
        title={mode === "approve" ? "Approve payment?" : mode === "reject" ? "Reject payment?" : "Mark needs review?"}
      >
        {mode === "approve" ? (
          <p className="text-sm leading-relaxed text-muted">
            This will activate the package, issue membership IDs, and run the commission engine. A second approve will not duplicate IDs.
          </p>
        ) : (
          <div>
            <Label htmlFor="why">{mode === "reject" ? "Rejection reason *" : "Review note *"}</Label>
            <Input id="why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Transaction not found" />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={act.isPending} onClick={() => setMode(null)}>Cancel</Button>
          <Button
            className="flex-1"
            variant={mode === "reject" ? "danger" : "primary"}
            disabled={act.isPending || (mode !== "approve" && reason.trim().length < 3)}
            onClick={() => act.mutate()}
          >
            {act.isPending ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </Modal>
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
