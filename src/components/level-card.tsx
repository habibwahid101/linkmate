import { Card, CardKicker, type CardTone } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar, ProgressMeta } from "@/components/progress-bar";
import { Money } from "@/components/money";
import { formatBdt } from "@/lib/money";
import { getLevel } from "@/lib/rules";
import { journeyState, levelRequirementCopy, progressNounShort } from "@/lib/id-workspace";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
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

function barTone(status: string): "success" | "progress" | "held" {
  if (status === "RELEASED" || status === "COMPLETED") return "success";
  if (status === "LOCKED") return "held";
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
          <CardKicker tone={levelTone(row.status)}>Level {row.level}</CardKicker>
          <p className="mt-1 text-[15px] text-ink">
            {levelRequirementCopy(row.level)} · {rule.rateLabel}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div>
        <ProgressMeta
          completed={row.completed_members}
          required={row.required_members}
          remaining={row.status === "LOCKED" ? undefined : row.remaining_members}
          noun={progressNounShort(row.level)}
        />
        <ProgressBar
          value={row.completed_members}
          max={row.required_members}
          tone={barTone(row.status)}
        />
      </div>
      {compact ? null : (
        <div className="flex items-end justify-between border-t border-border/70 pt-3">
          <div>
            <p className="text-[13px] text-muted">Commission</p>
            <p className="tabular text-[15px] font-medium">
              {formatBdt(row.accumulated_commission)}{" "}
              <span className="text-muted">/ {formatBdt(row.expected_full_commission)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Wallet release</p>
            <p className="text-[15px] font-medium">{release}</p>
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
      <CardKicker tone={tone}>{label}</CardKicker>
      <div className="mt-2 min-w-0 overflow-hidden">
        {typeof value === "number" ? <Money amount={value} size="lg" /> : value}
      </div>
      {hint ? <p className="mt-1.5 truncate text-[13px] leading-snug text-muted">{hint}</p> : null}
    </Card>
  );
}

export function LevelJourney({
  rows,
  graduated,
}: {
  rows: Array<{ level: number; status: string; completed_members?: number; required_members?: number }>;
  graduated: boolean;
}) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-9">
      {rows.map((row) => {
        const state = journeyState(row, graduated);
        const label =
          state === "graduated"
            ? "Graduated"
            : state === "completed"
              ? "Done"
              : state === "current"
                ? "Current"
                : "Locked";
        return (
          <li
            key={row.level}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl px-1.5 py-2 text-center",
              state === "completed" || state === "graduated"
                ? "bg-surface-success text-success"
                : state === "current"
                  ? "bg-surface-progress text-progress shadow-[0_0_0_1px_var(--color-border-progress)]"
                  : "bg-surface-2 text-muted",
            )}
          >
            {state === "completed" || state === "graduated" ? (
              <Check className="mb-0.5 size-3.5" strokeWidth={2.5} aria-hidden="true" />
            ) : null}
            <p className="text-[13px] font-semibold">L{row.level}</p>
            <p className="mt-0.5 text-[11px] font-medium leading-tight">{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
