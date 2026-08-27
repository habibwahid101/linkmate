import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { RequireAuth } from "@/components/guards";
import { NoAccess, QueryError } from "@/components/query-error";
import { AdminShellPending } from "@/components/shell-pending";
import { useMinPending } from "@/hooks/use-min-pending";
import { shouldShowQueryError } from "@/lib/ui/min-pending";
import { getShell } from "@/lib/server/profile";

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
  const shell = useQuery({
    queryKey: ["shell"],
    queryFn: () => getShell(),
    placeholderData: keepPreviousData,
  });
  const waiting = shell.isPending || (!shell.data && !shell.isError);
  const hold = useMinPending(waiting);
  if (hold) return <AdminShellPending />;
  if (shouldShowQueryError(shell) || !shell.data) {
    return (
      <AdminShell>
        <QueryError error={shell.error} retry={() => shell.refetch()} />
      </AdminShell>
    );
  }
  if (shell.data.profile.role !== "admin") {
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
