import { BrandLink } from "@/components/logo";
import type { ReactNode } from "react";

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-fg lg:flex">
        <BrandLink invert />
        <div className="max-w-sm">
          <p className="text-3xl font-semibold tracking-tight text-balance">
            Membership you can read at a glance.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-muted">
            Packages, IDs, generation progress, and a wallet that only releases when a level is complete.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Held until complete. Then released in full.</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
        <div className="lg:hidden">
          <BrandLink />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
