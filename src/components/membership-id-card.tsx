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
  progressFraction,
  isGraduated,
  type CompactMembershipId,
} from "@/lib/id-workspace";
import { designationSummary } from "@/lib/engine/designations";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function MembershipIdCard({
  row,
  compact = false,
  selectPath,
  selected = false,
}: {
  row: CompactMembershipId;
  compact?: boolean;
  selectPath?: "/app";
  selected?: boolean;
}) {
  const graduated = isGraduated(row);
  const p = row.currentProgress;
  const designation = designationSummary(row.designationCount);
  return (
    <Card
      tone={graduated ? "success" : row.held > 0 ? "held" : "info"}
      className={cn("min-w-0", compact && "p-3.5 sm:p-4", selected && "ring-2 ring-accent")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[15px] font-semibold">
            {selectPath ? (
              <Link to={selectPath} search={{ id: row.id }} className="hover:text-accent">
                {row.id}
              </Link>
            ) : (
              row.id
            )}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {packageLabel(row.package_id)} · {originLabel(row)}
          </p>
        </div>
        <StatusBadge status={graduated ? "GRADUATED" : row.progression_status} />
      </div>
      <p className="mt-2 text-[15px] font-semibold">{designation.label}</p>
      <p className="text-[13px] text-muted">{designation.detail}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              <th className="pb-2 pr-3 font-semibold">Level</th>
              <th className="pb-2 pr-3 font-semibold">Progress</th>
              <th className="pb-2 pr-3 font-semibold">Sponsors</th>
              <th className="pb-2 pr-3 font-semibold">Held</th>
              <th className="pb-2 pr-3 font-semibold">Released</th>
              <th className="pb-2 font-semibold">Available</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-[15px] font-medium">
              <td className="pr-3 align-top">{graduated ? "Graduated" : `Level ${row.current_level}`}</td>
              <td className="tabular pr-3 align-top">{graduated ? "Complete" : progressFraction(p)}</td>
              <td className="tabular pr-3 align-top">{row.designationCount}</td>
              <td className="pr-3 align-top">
                <Money amount={row.held} size="sm" className="text-held" />
              </td>
              <td className="pr-3 align-top">
                <Money amount={row.released} size="sm" className="text-success" />
              </td>
              <td className="align-top">
                <Money amount={row.available} size="sm" className="text-accent" />
              </td>
            </tr>
          </tbody>
        </table>
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

export function MembershipIdRow({
  row,
  selectPath,
  selected = false,
}: {
  row: CompactMembershipId;
  selectPath?: "/app";
  selected?: boolean;
}) {
  const graduated = isGraduated(row);
  const p = row.currentProgress;
  const designation = designationSummary(row.designationCount);
  const t = useT();
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl bg-surface p-3.5 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_auto] sm:items-center sm:gap-2 sm:px-4",
        graduated
          ? "shadow-[inset_3px_0_0_var(--color-success),var(--shadow-card)]"
          : row.held > 0
            ? "shadow-[inset_3px_0_0_var(--color-held),var(--shadow-card)]"
            : "shadow-[var(--shadow-card)]",
        selected && "ring-2 ring-accent",
      )}
    >
      <div className="min-w-0">
        <p className="break-all font-mono text-[15px] font-semibold">
          {selectPath ? (
            <Link to={selectPath} search={{ id: row.id }} className="hover:text-accent">
              {row.id}
            </Link>
          ) : (
            row.id
          )}
        </p>
        <p className="text-[13px] text-muted">
          {packageLabel(row.package_id)} · {originLabel(row)}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold">
          {t("dash.designation")}: {designation.label}
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
