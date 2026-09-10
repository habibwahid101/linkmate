import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminNetwork } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { packageLabel } from "@/lib/format";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/admin/network")({ component: Network });

function Network() {
  const [focus, setFocus] = useState<string | undefined>();
  const q = useQuery({
    queryKey: ["admin", "network", focus],
    queryFn: () => adminNetwork({ data: { memberId: focus } }),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const stats = q.data.stats;
  return (
    <div>
      <PageHeader
        title="Network"
        hint="Read-only. Direct IDs, Downline IDs, and Network Depth come from existing sponsor and placement data. Trees cannot be dragged or rewritten here."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {q.data.roots.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setFocus(r.id)}
            className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          {stats ? (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Card tone="info">
                <p className="text-xs uppercase tracking-wider text-muted">Direct IDs</p>
                <p className="mt-2 tabular text-xl font-semibold">{stats.directIds}</p>
              </Card>
              <Card tone="progress">
                <p className="text-xs uppercase tracking-wider text-muted">Downline IDs</p>
                <p className="mt-2 tabular text-xl font-semibold">{stats.downlineIds}</p>
              </Card>
              <Card tone="progress">
                <p className="text-xs uppercase tracking-wider text-muted">Network Depth</p>
                <p className="mt-2 tabular text-xl font-semibold">{stats.networkDepth}</p>
              </Card>
            </div>
          ) : null}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-9">
            {q.data.progress.map((p) => (
              <Card key={p.level} className="p-3 text-center" tone="progress">
                <p className="text-[11px] text-muted">L{p.level}</p>
                <p className="tabular text-sm font-semibold">
                  {p.completed_members}/{p.required_members}
                </p>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {q.data.children.length === 0 ? (
              <EmptyState title="No related IDs" body="This Membership ID has no Direct IDs or downline placement yet." />
            ) : (
              q.data.children.map((c) => (
                <Card key={c.child_id} className="flex items-center justify-between gap-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => setFocus(c.child_id)}>
                    <p className="text-sm font-medium">{c.display_name}</p>
                    <p className="font-mono text-xs text-muted">{c.child_id}</p>
                    <p className="text-xs text-muted">
                      {packageLabel(c.package_id)} · parent {c.parent_id}
                      {c.generation ? ` · Network Depth ${c.generation}` : ""}
                    </p>
                  </button>
                  <span className="text-xs text-muted">{packageLabel(c.package_id)}</span>
                </Card>
              ))
            )}
          </div>
        </>
      ) : (
        <EmptyState title="No root IDs yet" body="Network inspection appears after Membership IDs are created by payment approval." />
      )}
    </div>
  );
}
