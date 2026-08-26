import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListAudit } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({ component: Audit });

function Audit() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: () => adminListAudit() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Audit logs" />
      <AdminList
        rows={q.data}
        columns={[
          { key: "act", label: "Action", render: (r) => r.action },
          { key: "who", label: "Actor", render: (r) => <span className="font-mono text-xs">{r.actor_user_id ?? "system"}</span> },
          { key: "ent", label: "Entity", render: (r) => `${r.entity_type} ${r.entity_id ?? ""}` },
          { key: "det", label: "Detail", render: (r) => r.detail ?? "—" },
          { key: "date", label: "When", render: (r) => formatDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
