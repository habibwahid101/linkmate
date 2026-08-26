import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminGetSettings } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBdt } from "@/lib/money";

export const Route = createFileRoute("/admin/packages")({ component: Packages });

function Packages() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Packages"
        hint="Locked amounts and ID counts cannot be edited casually. Changes require versioning and an audit log."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {q.data.packages.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">{p.name}</h2>
              <Badge tone={p.locked ? "locked" : "accent"}>{p.locked ? "Locked" : "Editable"}</Badge>
            </div>
            <p className="mt-2 tabular text-2xl font-semibold">{formatBdt(p.amount_bdt)}</p>
            <p className="mt-1 text-sm text-muted">
              {p.id_count} IDs · placement {p.placement_rule_version} · {p.active ? "Active" : "Inactive"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
