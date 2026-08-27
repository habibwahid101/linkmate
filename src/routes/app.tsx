import { createFileRoute, Outlet } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/guards";
import { QueryError } from "@/components/query-error";
import { AppShellPending } from "@/components/shell-pending";
import { useMinPending } from "@/hooks/use-min-pending";
import { shouldShowQueryError } from "@/lib/ui/min-pending";
import { getShell } from "@/lib/server/profile";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireAuth>
      <AppFrame />
    </RequireAuth>
  );
}

function AppFrame() {
  const shell = useQuery({
    queryKey: ["shell"],
    queryFn: () => getShell(),
    placeholderData: keepPreviousData,
  });
  const waiting = shell.isPending || (!shell.data && !shell.isError);
  const hold = useMinPending(waiting);
  if (hold) {
    return (
      <AppShellPending
        unread={shell.data?.unread ?? 0}
        isAdmin={shell.data?.profile.role === "admin"}
      />
    );
  }
  if (shouldShowQueryError(shell) || !shell.data) {
    return (
      <AppShell unread={0} isAdmin={false}>
        <QueryError error={shell.error} retry={() => shell.refetch()} />
      </AppShell>
    );
  }
  return (
    <AppShell unread={shell.data.unread} isAdmin={shell.data.profile.role === "admin"}>
      <Outlet />
    </AppShell>
  );
}
