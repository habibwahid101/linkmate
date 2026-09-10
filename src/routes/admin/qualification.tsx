import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListQualification } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch, FilterChips } from "@/components/admin-filters";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { packageLabel } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/qualification")({ component: Qualification });

function Qualification() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<"all" | "qualified" | "not">("all");
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "qualification"], queryFn: () => adminListQualification() });
  const rows = useMemo(() => {
    let data = list.data ?? [];
    if (filter === "qualified") data = data.filter((r) => r.qualified);
    if (filter === "not") data = data.filter((r) => !r.qualified);
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => `${r.id} ${r.display_name}`.toLowerCase().includes(needle));
  }, [list.data, filter, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  const qualifiedCount = (list.data ?? []).filter((r) => r.qualified).length;
  return (
    <div>
      <PageHeader
        title="1 Decimal Land"
        hint="Qualification requires an active Membership ID, 3 Direct IDs, and Level 9 complete. Qualification is not legal ownership, allocation, or transfer. Documentation status is not stored yet."
      />
      <p className="mb-3 text-sm text-muted">{qualifiedCount} Qualified · {(list.data?.length ?? 0) - qualifiedCount} Not Yet Qualified</p>
      <FilterChips
        options={[
          { id: "all", label: "All" },
          { id: "qualified", label: "Qualified" },
          { id: "not", label: "Not Yet Qualified" },
        ]}
        value={filter}
        onChange={setFilter}
        labelledBy="Qualification state"
      />
      <AdminSearch value={q} onChange={setQ} label="Search qualification" placeholder="Search Membership ID or account" />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.qualification.title}
        empty={ADMIN_EMPTY.qualification.body}
        caption="Land qualification"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.id } })}
        columns={[
          { key: "id", label: "Membership ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "pkg", label: "Package", hideOnMobile: true, render: (r) => packageLabel(r.package_id) },
          { key: "mem", label: "Membership", render: (r) => <StatusBadge status={r.membershipStatus} /> },
          {
            key: "sp",
            label: "Direct IDs",
            render: (r) => `${r.sponsorProgress}/${r.sponsorRequired}`,
          },
          {
            key: "lv",
            label: "Levels",
            render: (r) => `${r.completedLevels}/${r.levelsRequired}`,
          },
          {
            key: "q",
            label: "Qualification",
            render: (r) => <Badge tone={r.qualified ? "success" : "held"}>{r.status}</Badge>,
          },
        ]}
      />
    </div>
  );
}
