import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListUsers, adminSetRole } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: Users });

function Users() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
  const role = useMutation({
    mutationFn: (p: { userId: string; role: "member" | "admin"; confirm: true }) =>
      adminSetRole({ data: p }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Users" hint="Production never auto-promotes the first signup. Promote admins only through this screen or provision-admin. Role changes are audited." />
      <AdminList
        rows={q.data.map((u) => ({ ...u, id: u.user_id }))}
        columns={[
          { key: "name", label: "Name", render: (r) => r.display_name },
          { key: "email", label: "Email", render: (r) => r.email ?? "—" },
          {
            key: "role",
            label: "Role",
            render: (r) => (
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  const next = r.role === "admin" ? "member" : "admin";
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(`Change ${r.display_name} to ${next}?`)
                  ) {
                    return;
                  }
                  role.mutate({ userId: r.user_id, role: next, confirm: true });
                }}
              >
                {r.role}
              </button>
            ),
          },
          { key: "ids", label: "IDs", render: (r) => r.id_count },
          { key: "ref", label: "Referral", render: (r) => <span className="font-mono text-xs">{r.referral_code}</span> },
          {
            key: "syn",
            label: "Type",
            render: (r) => (r.is_synthetic ? <Badge tone="locked">Simulated</Badge> : <Badge tone="accent">Member</Badge>),
          },
          { key: "date", label: "Joined", hideOnMobile: true, render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  );
}
