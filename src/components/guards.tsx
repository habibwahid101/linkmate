import { RedirectToSignIn } from "@/lib/auth/gates";
import { AdminShellPending, AppShellPending } from "@/components/shell-pending";
import { useSessionGate } from "@/hooks/use-session-gate";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useSessionGate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isPending) {
    return pathname.startsWith("/admin") ? <AdminShellPending /> : <AppShellPending />;
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
