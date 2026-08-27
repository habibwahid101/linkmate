import { AdminShell } from "@/components/admin-shell";
import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function AppShellPending({
  unread = 0,
  isAdmin = false,
}: {
  unread?: number;
  isAdmin?: boolean;
}) {
  return (
    <AppShell unread={unread} isAdmin={isAdmin}>
      <DashboardSkeleton />
    </AppShell>
  );
}

export function AdminShellPending() {
  return (
    <AdminShell>
      <DashboardSkeleton />
    </AdminShell>
  );
}
