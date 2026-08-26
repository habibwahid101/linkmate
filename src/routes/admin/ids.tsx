import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListIds } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, packageLabel } from "@/lib/format";

export const Route = createFileRoute("/admin/ids")({ component: Ids });

function Ids() {
  const q = useQuery({ queryKey: ["admin", "ids"], queryFn: () => adminListIds() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="IDs" />
      <AdminList
        rows={q.data}
        columns={[
          { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { key: "owner", label: "Owner", render: (r) => r.display_name },
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "sp", label: "Sponsor", render: (r) => <span className="font-mono text-xs">{r.sponsor_id ?? "—"}</span> },
          { key: "parent", label: "Parent", render: (r) => <span className="font-mono text-xs">{r.parent_id ?? "—"}</span> },
          { key: "place", label: "Placement", render: (r) => <StatusBadge status={r.placement_status} /> },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Created", render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
