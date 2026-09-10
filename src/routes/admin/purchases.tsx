import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListPurchases } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch } from "@/components/admin-filters";
import { StatusBadge } from "@/components/status-badge";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/purchases")({ component: Purchases });

function Purchases() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "purchases"], queryFn: () => adminListPurchases() });
  const rows = useMemo(() => {
    const data = list.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => `${r.display_name} ${r.package_id} ${r.root_id ?? ""} ${r.id}`.toLowerCase().includes(needle));
  }, [list.data, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader title="Purchases" hint="Package activation stays atomic. Admin never creates Membership IDs from this list." />
      <AdminSearch value={q} onChange={setQ} label="Search purchases" placeholder="Search member, package, or root ID" />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.purchases.title}
        empty={ADMIN_EMPTY.purchases.body}
        caption="Package purchases"
        onRow={(r) => nav({ to: "/admin/users/$userId", params: { userId: r.user_id } })}
        columns={[
          { key: "pkg", label: "Package", render: (r) => packageLabel(r.package_id) },
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "amt", label: "Amount", render: (r) => formatBdt(toInt(r.amount_bdt)) },
          { key: "ids", label: "IDs created", render: (r) => r.id_count },
          { key: "root", label: "Root ID", hideOnMobile: true, render: (r) => <span className="font-mono text-xs">{r.root_id ?? "—"}</span> },
          { key: "st", label: "Payment", render: (r) => <StatusBadge status={r.payment_status} /> },
          { key: "date", label: "Date", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
