import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListWallets, adminLedgerAdjustment } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AdminWithdrawalPanel } from "@/components/withdrawal-panel";
import { formatBdt } from "@/lib/money";
import { toInt } from "@/lib/money";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/wallets")({ component: Wallets });

function Wallets() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "wallets"], queryFn: () => adminListWallets() });
  const [target, setTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const adj = useMutation({
    mutationFn: () =>
      adminLedgerAdjustment({
        data: { memberId: target!, amount: Number(amount), reason, confirm: true },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Ledger adjustment posted");
      setTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Wallets" hint="Do not edit balances silently. Use a ledger adjustment with a reason. Withdrawals reserve available funds only." />
      <AdminWithdrawalPanel />
      <AdminList
        rows={q.data.map((w) => ({ ...w, id: w.member_id }))}
        onRow={(r) => setTarget(r.member_id)}
        columns={[
          { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs">{r.member_id}</span> },
          { key: "who", label: "Owner", render: (r) => r.display_name },
          { key: "av", label: "Available", render: (r) => formatBdt(toInt(r.available_balance)) },
          { key: "rel", label: "Released", render: (r) => formatBdt(toInt(r.total_released)) },
        ]}
      />
      <Modal open={!!target} onClose={() => setTarget(null)} title="Ledger adjustment">
        <p className="mb-3 text-sm text-muted">
          Posts a signed amount to {target}. Positive credits, negative debits.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amt">Amount (BDT integer)</Label>
            <Input id="amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rs">Reason</Label>
            <Input id="rs" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button className="w-full" disabled={adj.isPending || reason.trim().length < 3} onClick={() => adj.mutate()}>
            {adj.isPending ? "Posting…" : "Confirm adjustment"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
