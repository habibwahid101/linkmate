import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminNetwork } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { packageLabel } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/admin/network")({ component: Network });

function Network() {
  const [focus, setFocus] = useState<string | undefined>();
  const q = useQuery({
    queryKey: ["admin", "network", focus],
    queryFn: () => adminNetwork({ data: { memberId: focus } }),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Sponsor network" hint="Sponsor and placement stay separate. This view follows placement plus generation of the focused ID." />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {q.data.roots.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setFocus(r.id)}
            className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium"
          >
            {r.id} · {r.display_name}
          </button>
        ))}
      </div>
      {q.data.focus ? (
        <>
          <p className="mb-3 text-sm text-muted">
            Focus <span className="font-mono text-ink">{q.data.focus}</span>
          </p>
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-9">
            {q.data.progress.map((p) => (
              <Card key={p.level} className="p-3 text-center">
                <p className="text-[11px] text-muted">L{p.level}</p>
                <p className="tabular text-sm font-semibold">
                  {p.completed_members}/{p.required_members}
                </p>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {q.data.children.length === 0 ? (
              <Card className="py-8 text-center text-sm text-muted">No related members.</Card>
            ) : (
              q.data.children.map((c) => (
                <Card key={c.child_id} className="flex items-center justify-between gap-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => setFocus(c.child_id)}>
                    <p className="text-sm font-medium">{c.display_name}</p>
                    <p className="font-mono text-xs text-muted">{c.child_id}</p>
                    <p className="text-xs text-muted">
                      {packageLabel(c.package_id)} · parent {c.parent_id}
                      {c.generation ? ` · gen ${c.generation}` : ""}
                    </p>
                  </button>
                  {c.generation ? <StatusBadge status={`G${c.generation}`} /> : null}
                </Card>
              ))
            )}
          </div>
        </>
      ) : (
        <Card className="py-10 text-center text-sm text-muted">No root IDs yet.</Card>
      )}
    </div>
  );
}
