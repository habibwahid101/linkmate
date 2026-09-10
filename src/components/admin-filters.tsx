import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  labelledBy?: string;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap gap-2"
      role="tablist"
      aria-label={labelledBy ?? "Filter"}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "h-9 rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="mb-4">
      <label className="sr-only" htmlFor="admin-search">
        {label}
      </label>
      <Input
        id="admin-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
