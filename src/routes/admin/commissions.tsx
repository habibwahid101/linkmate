import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListCommissions, adminReverseJoin } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { toInt } from "@/lib/money";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/commissions")({ component: Commissions });

function Commissions() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | undefined>();
  const [sourceId, setSourceId] = useState("");
  const [reason, setReason] = useState("Join reversed");
  const q = useQuery({
    queryKey: ["admin", "commissions", status],
    queryFn: () => adminListCommissions({ data: { status } }),
  });
  const reverse = useMutation({
    mutationFn: () =>
      adminReverseJoin({ data: { sourceId: sourceId.trim(), reason, confirm: true } }),
    onSuccess: (r) => {
      void qc.invalidateQueries();
      toast.success(`Reversed ${r.reversed} ledger rows. History kept.`);
      setSourceId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Commissions" hint="Ledger entries. Duplicate join events are rejected by event_id. Reversal keeps history." />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "HELD", "RELEASED", "REVERSED"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s || undefined)}
            className="h-9 rounded-full bg-surface-2 px-3 text-xs font-medium"
          >
            {s || "All"}
          </button>
        ))}
      </div>
      <div className="mb-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="text-sm font-medium">Reverse a source ID</p>
        <p className="mt-1 text-xs text-muted">Marks matching HELD/RELEASED rows REVERSED, claws back released amounts, and recounts progress. Rows are never deleted.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="src">Source member ID</Label>
            <Input id="src" value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="LM-100010" />
          </div>
          <div>
            <Label htmlFor="rs">Reason</Label>
            <Input id="rs" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            className="sm:mt-6"
            variant="danger"
            disabled={reverse.isPending || sourceId.trim().length < 3}
            onClick={() => reverse.mutate()}
          >
            {reverse.isPending ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </div>
      <AdminList
        rows={q.data}
        columns={[
          { key: "ben", label: "Beneficiary", render: (r) => <span className="font-mono text-xs">{r.beneficiary_id}</span> },
          { key: "src", label: "Source", render: (r) => <span className="font-mono text-xs">{r.source_id}</span> },
          { key: "lv", label: "Level", render: (r) => `L${r.level} G${r.generation}` },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.commission_amount)) },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Held", render: (r) => formatDateTime(r.held_at) },
        ]}
      />
    </div>
  );
}
