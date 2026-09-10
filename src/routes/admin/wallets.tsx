import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListWallets, adminLedgerAdjustment } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch } from "@/components/admin-filters";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatBdt, toInt } from "@/lib/money";
import { toast } from "sonner";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/wallets")({ component: Wallets });

function Wallets() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "wallets"], queryFn: () => adminListWallets() });
  const [target, setTarget] = useState<string>("");
  const [adjustOpen, setAdjustOpen] = useState(false);
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
      setAdjustOpen(false);
      setTarget("");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = useMemo(() => {
    const data = (list.data ?? []).map((w) => ({ ...w, id: w.member_id }));
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => `${r.member_id} ${r.display_name}`.toLowerCase().includes(needle));
  }, [list.data, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Wallets"
        hint="Available is distinct from released and held. Do not edit balances silently. Ledger adjustments require a reason and are audited. Withdrawals are processed on the Withdrawals queue."
        action={
          <Button variant="outline" onClick={() => nav({ to: "/admin/withdrawals" })}>
            Withdrawals
          </Button>
        }
      />
      <AdminSearch value={q} onChange={setQ} label="Search wallets" placeholder="Search Membership ID or account" />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.wallets.title}
        empty={ADMIN_EMPTY.wallets.body}
        caption="Wallets by Membership ID"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.member_id } })}
        columns={[
          { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs">{r.member_id}</span> },
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "av", label: "Available", render: (r) => formatBdt(toInt(r.available_balance)) },
          { key: "held", label: "Held", render: (r) => formatBdt(toInt(r.held)) },
          { key: "rel", label: "Released", render: (r) => formatBdt(toInt(r.total_released)) },
        ]}
      />
      <p className="mt-3 text-xs text-muted">
        Need a signed correction? Open the Membership ID, then post an audited adjustment from this page.
      </p>
      <Button className="mt-2" variant="outline" onClick={() => setAdjustOpen(true)}>
        Post ledger adjustment
      </Button>
      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Ledger adjustment">
        <p className="mb-3 text-sm text-muted">
          Posts a signed amount to {target}. Positive credits, negative debits. This is audited.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="adj-id">Membership ID</Label>
            <Input id="adj-id" value={target ?? ""} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="amt">Amount (BDT integer)</Label>
            <Input id="amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rs">Reason</Label>
            <Input id="rs" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button className="w-full" disabled={adj.isPending || reason.trim().length < 3 || !target} onClick={() => adj.mutate()}>
            {adj.isPending ? "Posting…" : "Confirm adjustment"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
