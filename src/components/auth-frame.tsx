import { BrandLink } from "@/components/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-surface-available p-10 text-ink lg:flex">
        <BrandLink />
        <div className="max-w-sm">
          <p className="text-3xl font-semibold tracking-tight text-balance">
            {t("auth.asideTitle")}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            {t("auth.asideBody")}
          </p>
        </div>
        <p className="text-[13px] text-muted">{t("auth.asideFoot")}</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="lg:hidden">
            <BrandLink />
          </div>
          <div className="ml-auto">
            <LocaleSwitch compact />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
          <div className="mt-8 rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
