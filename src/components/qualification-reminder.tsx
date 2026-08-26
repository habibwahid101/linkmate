export function QualificationReminder({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-2xl bg-accent-soft px-4 py-4 text-sm text-ink" aria-label="Land benefit qualification">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Land Benefit Qualification</p>
      <p className="mt-2 font-medium">Mandatory: Sponsor 3 + Complete Level 9</p>
      <p className="mt-1 text-muted">
        Qualified benefit: 1 Katha land. Subject to applicable allocation and transfer terms.
        {compact ? null : " Package size does not change these qualification requirements."}
      </p>
    </aside>
  );
}
