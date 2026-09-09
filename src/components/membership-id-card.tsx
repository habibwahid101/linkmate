import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Money } from "@/components/money";
import { CopyButton } from "@/components/copy-button";
import { packageLabel } from "@/lib/format";
import {
  originLabel,
  idStatusLabel,
  progressFraction,
  remainingCopy,
  progressNounShort,
  isGraduated,
  type CompactMembershipId,
} from "@/lib/id-workspace";
import { cn } from "@/lib/utils";

export function MembershipIdCard({
  row,
  compact = false,
}: {
  row: CompactMembershipId;
  compact?: boolean;
}) {
  const graduated = isGraduated(row);
  const status = idStatusLabel(row);
  const p = row.currentProgress;
  return (
    <Card
      tone={graduated ? "success" : row.held > 0 ? "held" : "info"}
      className={cn("min-w-0", compact && "p-3.5 sm:p-4")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[15px] font-semibold">{row.id}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {packageLabel(row.package_id)} · {originLabel(row)}
          </p>
        </div>
        <StatusBadge status={graduated ? "GRADUATED" : row.progression_status} />
      </div>
      <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <Metric
          label="Current level"
          value={graduated ? "Graduated" : `Level ${row.current_level}`}
        />
        <Metric
          label={progressNounShort(p.level)}
          value={graduated ? "Journey complete" : progressFraction(p)}
        />
        <Metric label="Direct IDs" value={`${row.directSponsors} / 3`} />
        <Metric label="Held" value={<Money amount={row.held} size="sm" className="text-held" />} />
      </div>
      {graduated ? (
        <p className="mt-3 text-[15px] leading-relaxed text-success">
          Level journey complete. History and earnings stay available.
        </p>
      ) : (
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] text-muted">
            <span>
              Level {p.level} · {progressFraction(p)}
            </span>
            <span className="tabular">{remainingCopy(p)}</span>
          </div>
          <ProgressBar
            value={p.completed}
            max={p.required}
            tone={row.held > 0 ? "held" : "progress"}
          />
        </div>
      )}
      <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        <div>
          <p className="text-[13px] text-muted">Released</p>
          <Money amount={row.released} size="sm" className="text-success" />
        </div>
        <div>
          <p className="text-[13px] text-muted">Available</p>
          <Money amount={row.available} size="sm" className="text-accent" />
        </div>
        {!compact ? (
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[13px] text-muted">Status</p>
            <p className="text-[15px] font-medium">{status}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {row.referral_code ? (
          <CopyButton value={row.referral_code} label="Copy referral" size="sm" />
        ) : null}
        <Link to="/app/ids/$memberId" params={{ memberId: row.id }} className="min-w-0 flex-1 sm:flex-none">
          <Button className="w-full" variant="primary" size="sm">
            View ID
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function MembershipIdRow({ row }: { row: CompactMembershipId }) {
  const graduated = isGraduated(row);
  const p = row.currentProgress;
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl bg-surface p-3.5 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_auto] sm:items-center sm:gap-2 sm:px-4",
        graduated
          ? "shadow-[inset_3px_0_0_var(--color-success),var(--shadow-card)]"
          : row.held > 0
            ? "shadow-[inset_3px_0_0_var(--color-held),var(--shadow-card)]"
            : "shadow-[var(--shadow-card)]",
      )}
    >
      <div className="min-w-0">
        <p className="break-all font-mono text-[15px] font-semibold">{row.id}</p>
        <p className="text-[13px] text-muted">
          {packageLabel(row.package_id)} · {originLabel(row)}
        </p>
      </div>
      <div>
        <p className="kicker text-muted">Level</p>
        <p className="tabular text-[15px] font-medium">{graduated ? "Graduated" : `L${row.current_level}`}</p>
      </div>
      <div className="min-w-0">
        <p className="kicker text-muted">Progress</p>
        <p className="tabular text-[15px] font-medium">{graduated ? "Complete" : progressFraction(p)}</p>
        {graduated ? null : (
          <ProgressBar className="mt-1.5" value={p.completed} max={p.required} tone={row.held > 0 ? "held" : "progress"} />
        )}
      </div>
      <div>
        <p className="kicker text-held">Held</p>
        <Money amount={row.held} size="sm" className="text-held" />
      </div>
      <div>
        <p className="kicker text-success">Released</p>
        <Money amount={row.released} size="sm" className="text-success" />
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <StatusBadge status={graduated ? "GRADUATED" : row.progression_status} />
        {row.referral_code ? <CopyButton value={row.referral_code} label="Copy" size="sm" /> : null}
        <Link to="/app/ids/$memberId" params={{ memberId: row.id }}>
          <Button size="sm" variant="primary">
            View
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-0.5 truncate text-[15px] font-medium">{value}</div>
    </div>
  );
}
