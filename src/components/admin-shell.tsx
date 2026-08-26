import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  ClipboardList,
  Gauge,
  GitFork,
  Layers,
  Receipt,
  Settings,
  Shield,
  Users,
  Wallet,
  IdCard,
  Bell,
  BarChart3,
  CircleDollarSign,
  PauseCircle,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const items = [
  { to: "/admin", label: "Overview", icon: Gauge },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/ids", label: "IDs", icon: IdCard },
  { to: "/admin/packages", label: "Packages", icon: Layers },
  { to: "/admin/purchases", label: "Purchases", icon: Receipt },
  { to: "/admin/payments", label: "Payments", icon: CircleDollarSign },
  { to: "/admin/network", label: "Network", icon: GitFork },
  { to: "/admin/levels", label: "Levels", icon: Shield },
  { to: "/admin/commissions", label: "Commissions", icon: CircleDollarSign },
  { to: "/admin/held", label: "Held", icon: PauseCircle },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet },
  { to: "/admin/transactions", label: "Transactions", icon: ClipboardList },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/audit", label: "Audit logs", icon: ClipboardList },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-4">
          <Wordmark />
        </div>
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Administration
        </p>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mb-0.5 flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/app"
          className="m-3 flex h-10 items-center gap-2 rounded-[10px] px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Member app
        </Link>
      </aside>
      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-md lg:px-8">
          <p className="text-sm font-medium">Admin</p>
          <Link to="/app" className="text-sm text-muted hover:text-ink">
            Back to app
          </Link>
        </header>
        <div className="lg:hidden overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1 px-3 py-2">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  pathname === item.to ? "bg-ink text-bg" : "bg-surface-2 text-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
