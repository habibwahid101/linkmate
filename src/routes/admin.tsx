import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { NoAccess, QueryError } from "@/components/query-error";
import { AdminShellPending } from "@/components/shell-pending";
import { useSessionGate } from "@/hooks/use-session-gate";
import { useMinPending } from "@/hooks/use-min-pending";
import { shouldShowQueryError } from "@/lib/ui/min-pending";
import { getShell } from "@/lib/server/profile";
import { RedirectToSignIn } from "@/lib/auth/gates";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  pendingComponent: () => <AdminShellPending />,
});

function AdminLayout() {
  const { user, isPending: authPending } = useSessionGate();
  const shell = useQuery({
    queryKey: ["shell"],
    queryFn: () => getShell(),
    placeholderData: keepPreviousData,
    enabled: Boolean(user),
  });
  const waiting = authPending || (Boolean(user) && (shell.isPending || (!shell.data && !shell.isError)));
  const hold = useMinPending(waiting);

  if (!authPending && !user) return <RedirectToSignIn />;

  if (!hold && shell.data && shell.data.profile.role !== "admin") {
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
      {shouldShowQueryError(shell) && user ? (
        <QueryError error={shell.error} retry={() => shell.refetch()} />
      ) : hold || !shell.data ? (
        <DashboardSkeleton />
      ) : (
        <Outlet />
      )}
    </AdminShell>
  );
}
