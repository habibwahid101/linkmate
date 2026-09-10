import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListIds } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch } from "@/components/admin-filters";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, packageLabel } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/ids/")({ component: Ids });

function Ids() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "ids"], queryFn: () => adminListIds() });
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => {
      const hay = `${r.id} ${r.display_name} ${r.referral_code ?? ""} ${r.sponsor_id ?? ""} ${r.owner_user_id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list.data, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Membership IDs"
        hint="Lookup LM-… IDs. Sponsor, placement, and level are engine-owned and cannot be edited here."
      />
      <AdminSearch
        value={q}
        onChange={setQ}
        label="Search Membership IDs"
        placeholder="Search LM- ID, owner, referral code, or sponsor"
      />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.ids.title}
        empty={ADMIN_EMPTY.ids.body}
        caption="Membership IDs"
        onRow={(r) => nav({ to: "/admin/ids/$memberId", params: { memberId: r.id } })}
        columns={[
          { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { key: "owner", label: "Account", render: (r) => r.display_name },
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "lv", label: "Level", render: (r) => `L${r.current_level ?? 1}` },
          { key: "sp", label: "Sponsor", hideOnMobile: true, render: (r) => <span className="font-mono text-xs">{r.sponsor_id ?? "—"}</span> },
          { key: "place", label: "Placement", hideOnMobile: true, render: (r) => <StatusBadge status={r.placement_status} /> },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Created", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
