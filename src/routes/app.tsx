import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/guards";
import { claimReferral, getShell } from "@/lib/server/profile";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

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
  const shell = useQuery({ queryKey: ["shell"], queryFn: () => getShell() });
  useEffect(() => {
    const code = typeof window !== "undefined" ? window.localStorage.getItem("lm-ref") : null;
    if (!code) return;
    void claimReferral({ data: { code } }).catch(() => undefined);
  }, []);
  return (
    <AppShell unread={shell.data?.unread ?? 0} isAdmin={shell.data?.profile.role === "admin"}>
      <Outlet />
    </AppShell>
  );
}
