import { createFileRoute, Outlet } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/query-error";
import { AppShellPending } from "@/components/shell-pending";
import { useSessionGate } from "@/hooks/use-session-gate";
import { useMinPending } from "@/hooks/use-min-pending";
import { shouldShowQueryError } from "@/lib/ui/min-pending";
import { getShell } from "@/lib/server/profile";
import { RedirectToSignIn } from "@/lib/auth/gates";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  pendingComponent: () => <AppShellPending />,
});

function AppLayout() {
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

  return (
    <AppShell unread={shell.data?.unread ?? 0} isAdmin={shell.data?.profile.role === "admin"}>
      {shouldShowQueryError(shell) && user ? (
        <QueryError error={shell.error} retry={() => shell.refetch()} />
      ) : hold || !shell.data ? (
        <DashboardSkeleton />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
