import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBdt } from "@/lib/money";
import type { PackageRule } from "@/lib/rules";
import { cn } from "@/lib/utils";

export function PackageCard({
  pkg,
  current,
  onSelect,
  cta = "Choose",
  busy = false,
  compact = false,
}: {
  pkg: PackageRule;
  current?: boolean;
  onSelect?: () => void;
  cta?: string;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-4",
        current && "shadow-[0_0_0_2px_var(--color-accent)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {compact ? null : <p className="text-xs font-medium uppercase tracking-wider text-muted">Package</p>}
          <h3 className={cn("font-semibold tracking-tight", compact ? "text-base" : "mt-0.5 text-lg")}>{pkg.name}</h3>
        </div>
        {current ? <Badge tone="accent">Current</Badge> : null}
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight">{formatBdt(pkg.amountBdt)}</p>
      <p className="text-sm text-muted">{pkg.idCount} ID{pkg.idCount === 1 ? "" : "s"}</p>
      <p className="text-sm leading-relaxed text-ink">{pkg.structureSummary}</p>
      {compact ? null : <p className="text-sm text-muted">{pkg.receives}</p>}
      {onSelect ? (
        <Button className="mt-auto w-full" onClick={onSelect} disabled={busy}>
          {busy ? "Working…" : cta}
        </Button>
      ) : null}
    </Card>
  );
}
