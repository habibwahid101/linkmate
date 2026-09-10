import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListAudit } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch } from "@/components/admin-filters";
import { formatDateTime } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/audit")({ component: Audit });

function Audit() {
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "audit"], queryFn: () => adminListAudit() });
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) =>
      `${r.action} ${r.entity_type} ${r.entity_id ?? ""} ${r.detail ?? ""} ${r.actor_user_id ?? ""}`.toLowerCase().includes(needle),
    );
  }, [list.data, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader title="Audit" hint="Existing records only. Payment review, activation, withdrawal processing, role changes, and settings updates." />
      <AdminSearch value={q} onChange={setQ} label="Search audit logs" placeholder="Search action, entity, or actor" />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.audit.title}
        empty={ADMIN_EMPTY.audit.body}
        caption="Audit logs"
        columns={[
          { key: "act", label: "Action", render: (r) => r.action },
          { key: "who", label: "Actor", render: (r) => <span className="font-mono text-xs">{r.actor_user_id ?? "system"}</span> },
          { key: "ent", label: "Entity", render: (r) => `${r.entity_type} ${r.entity_id ?? ""}` },
          { key: "det", label: "Detail", hideOnMobile: true, render: (r) => r.detail ?? "—" },
          { key: "date", label: "When", hideOnMobile: true, render: (r) => formatDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
