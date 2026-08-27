import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AdminShellPending, AppShellPending } from "@/components/shell-pending";
import { useMinPending } from "@/hooks/use-min-pending";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const hold = useMinPending(isPending);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (hold) {
    return pathname.startsWith("/admin") ? <AdminShellPending /> : <AppShellPending />;
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
