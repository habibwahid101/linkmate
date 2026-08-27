import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyWithdrawals, requestWithdrawal } from "@/lib/server/withdrawals";
import { adminListWithdrawals, adminProcessWithdrawal } from "@/lib/server/withdrawals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export function MemberWithdrawalPanel({
  memberId,
  available,
}: {
  memberId: string | null;
  available: number;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["withdrawals"], queryFn: () => listMyWithdrawals() });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bkash" | "nagad" | "bank">("bkash");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const req = useMutation({
    mutationFn: () =>
      requestWithdrawal({
        data: {
          memberId: memberId!,
          amountBdt: Number(amount),
          payoutMethod: method,
          payoutAccount: account,
          payoutName: name,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Withdrawal submitted for admin review");
      setAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return null;
  const policy = q.data?.policy;
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold">Request withdrawal</h2>
      <Card>
        <p className="text-sm text-muted">
          Only released available balance can be withdrawn. Held commission is locked.
          {policy?.ownerConfigRequired ? " Minimum and fee are owner-configurable (currently 0)." : ""}
        </p>
        <p className="mt-2 text-sm">Available: {formatBdt(available)}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wamt">Amount (BDT)</Label>
            <Input id="wamt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wm">Payout method</Label>
            <select id="wm" className="h-11 w-full rounded-[12px] bg-surface px-3 text-sm shadow-[0_0_0_1px_var(--color-border)]" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div>
            <Label htmlFor="wacc">Account / number</Label>
            <Input id="wacc" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wn">Account name</Label>
            <Input id="wn" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4 w-full sm:w-auto"
          disabled={!memberId || available <= 0 || req.isPending || Number(amount) <= 0}
          onClick={() => req.mutate()}
        >
          {req.isPending ? "Submitting…" : "Submit withdrawal"}
        </Button>
        <div className="mt-5 space-y-2">
          {(q.data?.requests ?? []).length === 0 ? (
            <p className="text-sm text-muted">No withdrawal requests yet.</p>
          ) : (
            q.data!.requests.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{formatBdt(w.amount_bdt)} · {w.payout_method}</p>
                  <p className="text-xs text-muted">{formatDateTime(w.created_at)}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export function AdminWithdrawalPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "withdrawals"], queryFn: () => adminListWithdrawals() });
  const act = useMutation({
    mutationFn: (input: { id: string; action: "APPROVE" | "PROCESS" | "PAY" | "REJECT" }) =>
      adminProcessWithdrawal({ data: { ...input, confirm: true } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(res.replayed ? "Already processed" : `Marked ${res.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data) return q.isError ? <p className="text-sm text-danger">Could not load withdrawals.</p> : null;
  if (q.data.length === 0) return <p className="mt-4 text-sm text-muted">No withdrawal requests.</p>;
  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-sm font-semibold">Withdrawal requests</h2>
      {q.data.map((w) => (
        <Card key={w.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{w.display_name} · {formatBdt(w.amount_bdt)}</p>
            <p className="font-mono text-xs text-muted">{w.member_id} · {w.payout_method}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={w.status} />
            {w.status === "PENDING" ? <Button variant="outline" onClick={() => act.mutate({ id: w.id, action: "APPROVE" })}>Approve</Button> : null}
            {w.status === "APPROVED" ? <Button variant="outline" onClick={() => act.mutate({ id: w.id, action: "PROCESS" })}>Processing</Button> : null}
            {w.status === "PROCESSING" || w.status === "APPROVED" ? <Button onClick={() => act.mutate({ id: w.id, action: "PAY" })}>Mark paid</Button> : null}
            {w.status === "PENDING" || w.status === "APPROVED" ? <Button variant="outline" onClick={() => act.mutate({ id: w.id, action: "REJECT" })}>Reject</Button> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
