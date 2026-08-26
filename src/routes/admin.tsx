import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { RequireAuth } from "@/components/guards";
import { NoAccess } from "@/components/query-error";
import { getShell } from "@/lib/server/profile";
import { useQuery } from "@tanstack/react-query";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <RequireAuth>
      <AdminFrame />
    </RequireAuth>
  );
}

function AdminFrame() {
  const shell = useQuery({ queryKey: ["shell"], queryFn: () => getShell() });
  if (shell.isPending) {
    return (
      <div className="min-h-dvh bg-bg p-6">
        <DashboardSkeleton />
      </div>
    );
  }
  if (shell.data?.profile.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <NoAccess />
        <p className="mt-4 text-center">
          <Link to="/app" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Back to app
          </Link>
        </p>
      </div>
    );
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
