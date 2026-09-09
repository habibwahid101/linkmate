import { cn } from "@/lib/utils";

export function QualificationReminder({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={cn(
        "rounded-2xl bg-surface-success px-4 text-ink shadow-[0_0_0_1px_var(--color-border-success)]",
        compact ? "py-3" : "py-4",
      )}
      aria-label="Land benefit qualification"
    >
      <p className="kicker text-success">Land Benefit Qualification</p>
      <p className={cn("font-medium", compact ? "mt-1.5 text-[15px]" : "mt-2 text-base")}>
        Mandatory: Sponsor 3 + Complete Level 9
      </p>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">
        Qualified benefit: 1 Decimal Land. Subject to applicable allocation and transfer terms.
        {compact ? null : " Package size does not change these qualification requirements."}
      </p>
    </aside>
  );
}
