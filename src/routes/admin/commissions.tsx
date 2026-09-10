import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListCommissions, adminReverseJoin } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { FilterChips } from "@/components/admin-filters";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatBdt, toInt } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/commissions")({ component: Commissions });

function Commissions() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"" | "HELD" | "RELEASED" | "REVERSED">("");
  const [sourceId, setSourceId] = useState("");
  const [reason, setReason] = useState("Join reversed");
  const q = useQuery({
    queryKey: ["admin", "commissions", status],
    queryFn: () => adminListCommissions({ data: { status: status || undefined } }),
  });
  const reverse = useMutation({
    mutationFn: () => adminReverseJoin({ data: { sourceId: sourceId.trim(), reason, confirm: true } }),
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
      <PageHeader title="Commissions" hint="Ledger entries from the existing engine. Duplicate join events are rejected by event_id. Reversal keeps history." />
      <FilterChips
        options={[
          { id: "", label: "All" },
          { id: "HELD", label: "Held" },
          { id: "RELEASED", label: "Released" },
          { id: "REVERSED", label: "Reversed" },
        ]}
        value={status}
        onChange={setStatus}
        labelledBy="Commission status"
      />
      <Card className="mb-4" tone="error">
        <p className="text-sm font-medium">Reverse a source ID</p>
        <p className="mt-1 text-xs text-muted">
          Marks matching HELD/RELEASED rows REVERSED, claws back released amounts, and recounts progress. Rows are never deleted.
        </p>
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
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm(`Reverse commissions for ${sourceId.trim()}?`)) return;
              reverse.mutate();
            }}
          >
            {reverse.isPending ? "Reversing…" : "Reverse"}
          </Button>
        </div>
      </Card>
      <AdminList
        rows={q.data}
        emptyTitle={ADMIN_EMPTY.commissions.title}
        empty={ADMIN_EMPTY.commissions.body}
        caption="Commission ledger"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.beneficiary_id } })}
        columns={[
          { key: "ben", label: "Beneficiary", render: (r) => <span className="font-mono text-xs">{r.beneficiary_id}</span> },
          { key: "src", label: "Source", render: (r) => <span className="font-mono text-xs">{r.source_id}</span> },
          { key: "lv", label: "Level", render: (r) => `L${r.level}` },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.commission_amount)) },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Held", hideOnMobile: true, render: (r) => formatDateTime(r.held_at) },
        ]}
      />
    </div>
  );
}
