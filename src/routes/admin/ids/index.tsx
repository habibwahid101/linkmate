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
import { packageLabel } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";
import { LocalDate } from "@/components/local-date";

export const Route = createFileRoute("/admin/ids/")({ component: Ids });

function Ids() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "ids"], queryFn: () => adminListIds() });
  const rows = useMemo(() => {
    const data = [...(list.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id, "en", { numeric: true }));
    const numbered = data.map((row, index) => ({ ...row, serial: index + 1 }));
    const needle = q.trim().toLowerCase();
    if (!needle) return numbered;
    return numbered.filter((r) => {
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
        hint="Joining serial. The earlier ID is first, the later ID is after it."
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
          { key: "serial", label: "Serial", render: (r) => r.serial },
          { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { key: "owner", label: "Account", render: (r) => r.display_name },
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "lv", label: "Level", render: (r) => `L${r.current_level ?? 1}` },
          { key: "sp", label: "Sponsor", hideOnMobile: true, render: (r) => <span className="font-mono text-xs">{r.sponsor_id ?? "—"}</span> },
          { key: "place", label: "Placement", hideOnMobile: true, render: (r) => <StatusBadge status={r.placement_status} /> },
          { key: "st", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", label: "Created", hideOnMobile: true, render: (r) => <LocalDate iso={r.created_at} /> },
        ]}
      />
    </div>
  );
}
