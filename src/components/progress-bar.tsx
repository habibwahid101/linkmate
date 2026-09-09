import { cn } from "@/lib/utils";

const FILL = {
  accent: "bg-accent",
  progress: "bg-progress",
  success: "bg-success",
  held: "bg-held",
} as const;

const TRACK = {
  accent: "bg-accent-soft",
  progress: "bg-progress-soft",
  success: "bg-success-soft",
  held: "bg-held-soft",
} as const;

export type ProgressTone = keyof typeof FILL;

export function ProgressBar({
  value,
  max,
  tone = "progress",
  className,
}: {
  value: number;
  max: number;
  tone?: ProgressTone;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full", TRACK[tone], className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${value} of ${max} (${pct}%)`}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none", FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressMeta({
  completed,
  required,
  remaining,
  noun,
}: {
  completed: number;
  required: number;
  remaining?: number;
  noun?: string;
}) {
  const pct = required <= 0 ? 0 : Math.min(100, Math.round((completed / required) * 100));
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[15px]">
      <span className="tabular font-medium">
        {completed} / {required}
        {noun ? <span className="font-normal text-muted"> {noun}</span> : null}
      </span>
      <span className="shrink-0 tabular text-muted">
        {remaining != null && remaining > 0 ? `${remaining} remaining` : `${pct}%`}
      </span>
    </div>
  );
}
