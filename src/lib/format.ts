export type DateLocale = "en" | "bn";

function localeTag(locale?: DateLocale): string | undefined {
  if (locale === "bn") return "bn-BD";
  return undefined;
}

export function formatDate(iso: string | null | undefined, locale?: DateLocale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined, locale?: DateLocale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sortTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function packageLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return id
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
