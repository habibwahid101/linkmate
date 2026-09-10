import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminGetWithdrawal, adminProcessWithdrawal } from "@/lib/server/withdrawals";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { publicErrorMessage } from "@/lib/public-error";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/withdrawals/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "withdrawal", id], queryFn: () => adminGetWithdrawal({ data: { id } }) });
  const [mode, setMode] = useState<"APPROVE" | "PROCESS" | "PAY" | "REJECT" | null>(null);
  const [note, setNote] = useState("");

  const act = useMutation({
    mutationFn: () =>
      adminProcessWithdrawal({
        data: { id, action: mode!, note: note.trim() || undefined, confirm: true },
      }),
    onSuccess: (res) => {
      toast.success(res.replayed ? "Already processed — no duplicate payout." : `Marked ${res.status}.`);
      setMode(null);
      setNote("");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(publicErrorMessage(e)),
  });

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const w = q.data;
  const net = toInt(w.amount_bdt) - toInt(w.fee_bdt);
  const open = w.status === "PENDING" || w.status === "APPROVED" || w.status === "PROCESSING";
  const details = w.payout_details ?? {};

  return (
    <div>
      <PageHeader
        title="Process withdrawal"
        hint="PAY is irreversible. Held funds were never reserved. Replay of PAY does not pay twice."
      />
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Status</p>
          <StatusBadge status={w.status} />
        </div>
        <Row label="Account" value={w.display_name} />
        <Row label="Email" value={w.email ?? "—"} />
        <Row label="Membership ID" value={w.member_id} />
        <Row label="Requested" value={formatBdt(toInt(w.amount_bdt))} />
        <Row label="Fee 5%" value={formatBdt(toInt(w.fee_bdt))} />
        <Row label="Net payout" value={formatBdt(net)} />
        <Row label="Method" value={w.payout_method} />
        <Row label="Payout account" value={String(details.account ?? details.payoutAccount ?? "—")} />
        <Row label="Account name" value={String(details.name ?? details.payoutName ?? "—")} />
        <Row label="Requested at" value={formatDateTime(w.created_at)} />
        {w.reviewed_at ? <Row label="Reviewed" value={formatDateTime(w.reviewed_at)} /> : null}
        {w.paid_at ? <Row label="Paid" value={formatDateTime(w.paid_at)} /> : null}
        {w.user_note ? <Row label="Member note" value={w.user_note} /> : null}
        {w.admin_note ? <Row label="Admin note" value={w.admin_note} /> : null}
      </Card>

      {open ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {w.status === "PENDING" ? (
            <Button onClick={() => setMode("APPROVE")}>Approve</Button>
          ) : null}
          {w.status === "APPROVED" ? (
            <Button variant="secondary" onClick={() => setMode("PROCESS")}>
              Mark processing
            </Button>
          ) : null}
          {w.status === "APPROVED" || w.status === "PROCESSING" ? (
            <Button onClick={() => setMode("PAY")}>Pay</Button>
          ) : null}
          {w.status === "PENDING" || w.status === "APPROVED" ? (
            <Button variant="danger" onClick={() => setMode("REJECT")}>
              Reject
            </Button>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold">Audit</h2>
      <div className="mt-3 space-y-2">
        {w.audit.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">No audit rows for this request yet.</Card>
        ) : (
          w.audit.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted">{a.detail ?? "—"}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(a.created_at)}</span>
            </Card>
          ))
        )}
      </div>

      <Link to="/admin/withdrawals" className={cn(buttonVariants({ variant: "ghost" }), "mt-4")}>
        Back to queue
      </Link>

      <Modal
        open={mode !== null}
        onClose={() => !act.isPending && setMode(null)}
        title={
          mode === "PAY"
            ? "Mark this withdrawal paid?"
            : mode === "REJECT"
              ? "Reject this withdrawal?"
              : mode === "APPROVE"
                ? "Approve this withdrawal?"
                : "Mark processing?"
        }
      >
        {mode === "PAY" ? (
          <p className="text-sm leading-relaxed text-muted">
            This records a net payout of {formatBdt(net)} after a {formatBdt(toInt(w.fee_bdt))} fee on{" "}
            {formatBdt(toInt(w.amount_bdt))}. PAY is irreversible. A second click will not pay twice.
          </p>
        ) : mode === "REJECT" ? (
          <p className="text-sm leading-relaxed text-muted">
            Rejection restores the reserved available balance. Held commission was never used.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            This updates the existing withdrawal lifecycle. It does not change the reserved amount.
          </p>
        )}
        <div className="mt-3">
          <Label htmlFor="wd-note">{mode === "REJECT" ? "Reason (optional)" : "Note (optional)"}</Label>
          <Input id="wd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid via bKash" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={act.isPending} onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant={mode === "REJECT" ? "danger" : "primary"}
            disabled={act.isPending}
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
