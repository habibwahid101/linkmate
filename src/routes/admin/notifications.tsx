import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListNotifications } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { AdminList } from "@/components/admin-list";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ADMIN_EMPTY } from "@/lib/admin-status";

export const Route = createFileRoute("/admin/notifications")({ component: Notes });

function Notes() {
  const q = useQuery({ queryKey: ["admin", "notes"], queryFn: () => adminListNotifications() });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Notifications" hint="Member notifications already sent by the platform." />
      <AdminList
        rows={q.data}
        emptyTitle={ADMIN_EMPTY.notifications.title}
        empty={ADMIN_EMPTY.notifications.body}
        caption="Notifications"
        columns={[
          { key: "who", label: "Account", render: (r) => r.display_name },
          { key: "title", label: "Title", render: (r) => r.title },
          { key: "kind", label: "Kind", render: (r) => r.kind },
          {
            key: "read",
            label: "Read",
            render: (r) => <Badge tone={r.read ? "locked" : "info"}>{r.read ? "Read" : "Unread"}</Badge>,
          },
          { key: "date", label: "Date", hideOnMobile: true, render: (r) => formatDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
