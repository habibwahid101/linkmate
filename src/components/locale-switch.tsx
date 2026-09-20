import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LocaleSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full bg-surface-2 p-0.5 shadow-[0_0_0_1px_var(--color-border)]",
        compact && "h-8",
      )}
      role="group"
      aria-label={t("lang.switch")}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide",
          locale === "en" ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted",
        )}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold",
          locale === "bn" ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted",
        )}
        aria-pressed={locale === "bn"}
        onClick={() => setLocale("bn")}
      >
        বাং
      </button>
    </div>
  );
}
