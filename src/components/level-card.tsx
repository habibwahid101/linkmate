import { Card, type CardTone } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Money } from "@/components/money";
import { formatBdt } from "@/lib/money";
import { getLevel, ordinalGeneration } from "@/lib/rules";
import type { ReactNode } from "react";

export type LevelRow = {
  level: number;
  generation: number;
  required_members: number;
  completed_members: number;
  remaining_members: number;
  accumulated_commission: number;
  expected_full_commission: number;
  status: string;
};

function levelTone(status: string): CardTone {
  if (status === "RELEASED" || status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS" || status === "ELIGIBLE") return "progress";
  if (status === "REVERSED") return "error";
  if (status === "LOCKED") return "default";
  return "progress";
}

export function LevelCard({ row, compact = false }: { row: LevelRow; compact?: boolean }) {
  const rule = getLevel(row.level);
  const release =
    row.status === "RELEASED"
      ? "Completed — Released"
      : row.status === "COMPLETED"
        ? "Ready to release"
        : "Pending";

  return (
    <Card className="flex flex-col gap-3" tone={levelTone(row.status)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-progress">
            Level {row.level}
          </p>
          <p className="mt-0.5 text-sm text-ink">
            {ordinalGeneration(row.generation)} Generation · {rule.rateLabel}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="tabular font-medium">
            {row.completed_members} / {row.required_members} Members
          </span>
          <span className="text-muted">{row.remaining_members} remaining</span>
        </div>
        <ProgressBar value={row.completed_members} max={row.required_members} />
      </div>
      {compact ? null : (
        <div className="flex items-end justify-between border-t border-border/70 pt-3">
          <div>
            <p className="text-xs text-muted">Commission</p>
            <p className="tabular text-sm font-medium">
              {formatBdt(row.accumulated_commission)}{" "}
              <span className="text-muted">/ {formatBdt(row.expected_full_commission)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Wallet release</p>
            <p className="text-sm font-medium">{release}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function LevelKpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: CardTone;
}) {
  return (
    <Card className="min-w-0" tone={tone}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2 min-w-0 overflow-hidden">
        {typeof value === "number" ? <Money amount={value} size="lg" /> : value}
      </div>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
