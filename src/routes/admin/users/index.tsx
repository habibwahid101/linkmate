import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListUsers } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { AdminSearch } from "@/components/admin-filters";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/users/")({ component: Users });

function Users() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
  const rows = useMemo(() => {
    const data = (list.data ?? []).map((u) => ({ ...u, id: u.user_id }));
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) => {
      const hay = `${r.display_name} ${r.email ?? ""} ${r.user_id} ${r.referral_code}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list.data, q]);
  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <QueryError error={list.error} retry={() => list.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Accounts"
        hint="An account is a person. Membership IDs belong to the account and earn independently. Locked platform operators cannot be demoted."
      />
      <AdminSearch
        value={q}
        onChange={setQ}
        label="Search accounts"
        placeholder="Search name, email, or referral code"
      />
      <AdminList
        rows={rows}
        emptyTitle={ADMIN_EMPTY.users.title}
        empty={ADMIN_EMPTY.users.body}
        caption="Member accounts"
        onRow={(r) => nav({ to: "/admin/users/$userId", params: { userId: r.user_id } })}
        columns={[
          { key: "name", label: "Account", render: (r) => r.display_name },
          { key: "email", label: "Email", render: (r) => r.email ?? "—" },
          { key: "role", label: "Role", render: (r) => (r.locked ? `${r.role} · locked` : r.role) },
          { key: "ids", label: "Membership IDs", render: (r) => r.id_count },
          {
            key: "ref",
            label: "Referral",
            hideOnMobile: true,
            render: (r) => <span className="font-mono text-xs">{r.referral_code}</span>,
          },
          {
            key: "syn",
            label: "Type",
            render: (r) =>
              r.is_synthetic ? <Badge tone="locked">Simulated</Badge> : <Badge tone="info">Account</Badge>,
          },
          { key: "date", label: "Joined", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
