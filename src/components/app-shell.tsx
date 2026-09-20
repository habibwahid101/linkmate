import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  BarChart3,
  Bell,
  Home,
  IdCard,
  Landmark,
  Layers,
  LogOut,
  Receipt,
  Settings,
  Share2,
  Shield,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { BrandLink } from "@/components/logo";
import { AccountAvatar } from "@/components/avatar";
import { LocaleSwitch } from "@/components/locale-switch";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import type { AppProfile } from "@/lib/server/profile";

const desktopNav = [
  { to: "/app", key: "shell.dash", icon: Home },
  { to: "/app/ids", key: "shell.ids", icon: IdCard },
  { to: "/app/team", key: "shell.network", icon: Users },
  { to: "/app/levels", key: "shell.levels", icon: BarChart3 },
  { to: "/app/packages", key: "shell.packages", icon: Layers },
  { to: "/app/payments", key: "shell.payments", icon: Receipt },
  { to: "/app/wallet", key: "shell.wallet", icon: Wallet },
  { to: "/app/earnings", key: "shell.earnings", icon: Banknote },
  { to: "/app/invite", key: "shell.invite", icon: Share2 },
  { to: "/app/notifications", key: "shell.notes", icon: Bell },
  { to: "/app/qualification", key: "shell.land", icon: Landmark },
  { to: "/app/profile", key: "shell.profile", icon: UserRound },
  { to: "/app/settings", key: "shell.settings", icon: Settings },
] as const;

const mobileNav = [
  { to: "/app", key: "shell.home", icon: Home },
  { to: "/app/ids", key: "shell.ids", icon: IdCard },
  { to: "/app/packages", key: "shell.packages", icon: Layers },
  { to: "/app/wallet", key: "shell.wallet", icon: Wallet },
  { to: "/app/profile", key: "shell.profile", icon: UserRound },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === to || pathname.startsWith(to + "/");
}

export function AppShell({
  children,
  unread = 0,
  isAdmin = false,
  profile,
}: {
  children: ReactNode;
  unread?: number;
  isAdmin?: boolean;
  profile?: AppProfile | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const t = useT();
  const [signingOut, setSigningOut] = useState(false);
  const displayName = profile?.displayName || user?.displayName || "Member";

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-sidebar text-sidebar-fg lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <BrandLink invert />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {desktopNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-fg"
                    : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2 : 1.75} />
                {t(item.key)}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              to="/admin"
              className="mt-2 flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
            >
              <Shield className="size-5" strokeWidth={1.75} />
              Admin
            </Link>
          ) : null}
        </nav>
        <div className="shrink-0 border-t border-white/8 p-4">
          <div className="flex items-center gap-3">
            <AccountAvatar name={displayName} src={profile?.avatarData} size="sm" invert />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-[13px] text-sidebar-muted">{user?.primaryEmail}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut("/login").catch(() => setSigningOut(false));
              }}
              className="grid size-11 place-items-center rounded-[10px] text-sidebar-muted hover:bg-white/8 hover:text-sidebar-fg"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-md lg:h-16 lg:px-8">
          <div className="lg:hidden">
            <BrandLink compact />
          </div>
          <div className="hidden text-[15px] text-muted lg:block">
            {t("shell.hint")}
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitch compact />
            {isAdmin ? (
              <Link
                to="/admin"
                className="grid size-11 place-items-center rounded-[12px] hover:bg-surface-2 lg:hidden"
                aria-label="Admin"
              >
                <Shield className="size-5" strokeWidth={1.75} />
              </Link>
            ) : null}
            <Link
              to="/app/notifications"
              className="relative grid size-11 place-items-center rounded-[12px] hover:bg-surface-2"
              aria-label="Notifications"
            >
              <Bell className="size-5" strokeWidth={1.75} />
              {unread > 0 ? (
                <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" />
              ) : null}
            </Link>
            <Link
              to="/app/invite"
              className="hidden h-11 items-center rounded-full bg-accent px-3.5 text-sm font-medium text-accent-fg sm:inline-flex"
            >
              {t("shell.invite")}
            </Link>
          </div>
        </header>
        <main className="safe-bottom mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
