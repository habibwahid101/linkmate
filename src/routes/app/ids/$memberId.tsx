import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMembershipIdDetail, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Money } from "@/components/money";
import { CopyButton } from "@/components/copy-button";
import { LevelCard, LevelJourney } from "@/components/level-card";
import { IdSwitcher, IdScopedLinks } from "@/components/id-switcher";
import { formatDate, formatDateTime, packageLabel } from "@/lib/format";
import {
  MEMBERSHIP_ID_NOT_FOUND,
  isGraduated,
  levelRequirementCopy,
  originLabel,
  progressFraction,
  remainingCopy,
} from "@/lib/id-workspace";
import { publicErrorMessage } from "@/lib/public-error";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/app/ids/$memberId")({ component: IdDashboard });

function IdDashboard() {
  const { memberId } = Route.useParams();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const detail = useQuery({
    queryKey: ["id-detail", memberId],
    queryFn: () => getMembershipIdDetail({ data: { memberId } }),
  });

  if (detail.isPending) return <DashboardSkeleton />;
  if (detail.isError) {
    const message = publicErrorMessage(detail.error);
    const missing = message.includes(MEMBERSHIP_ID_NOT_FOUND) || /not found|do not have access/i.test(message);
    if (missing) {
      return (
        <div>
          <PageHeader title="Membership ID" />
          <EmptyState
            title="This Membership ID is not in your account"
            body="You can only open IDs you own. Return to My Membership IDs to pick one of yours."
            action="My Membership IDs"
            actionTo="/app/ids"
          />
        </div>
      );
    }
    return <QueryError error={detail.error} retry={() => detail.refetch()} />;
  }

  const d = detail.data;
  const graduated = isGraduated(d);
  const p = d.currentProgress;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = d.referral_code ? `${origin}/signup?ref=${encodeURIComponent(d.referral_code)}` : "";

  return (
    <div>
      <PageHeader
        title={d.id}
        hint={
          ids.data ? (
            <IdSwitcher ids={ids.data} selectedId={d.id} />
          ) : (
            <span className="font-mono text-xs">{d.id}</span>
          )
        }
      />

      <IdHeader detail={d} link={link} graduated={graduated} />

      <section className="mt-4">
        <Card tone={graduated ? "success" : "progress"}>
          {graduated ? (
            <>
              <CardKicker tone="success">Graduated</CardKicker>
              <p className="mt-1 text-lg font-semibold">Level journey complete</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                This ID finished Level 9. History, earnings, network, and referral remain available. There is no Level 10.
              </p>
            </>
          ) : (
            <>
              <CardKicker tone="progress">Current level</CardKicker>
              <p className="mt-1 text-lg font-semibold">
                Level {p.level} · {progressFraction(p)} complete
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                {levelRequirementCopy(p.level)} · {remainingCopy(p)}
              </p>
              <ProgressBar className="mt-3" value={p.completed} max={p.required} tone={d.wallet.held > 0 ? "held" : "progress"} />
            </>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <CardTitle>Level journey</CardTitle>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">
          Level 1 needs 3 direct sponsored IDs. Levels 2–9 count eligible downline IDs — not generation depth.
        </p>
        <div className="mt-3">
          <LevelJourney rows={d.journey} graduated={graduated} />
        </div>
        <div className="mt-3 space-y-3">
          {d.journey
            .filter((row) => row.status !== "LOCKED")
            .map((row) => (
              <LevelCard key={row.level} row={row} compact />
            ))}
        </div>
        <p className="mt-3 text-sm">
          <Link to="/app/levels" search={{ id: d.id }} className="font-medium text-accent">
            Open full level progress
          </Link>
        </p>
      </section>

      <section className="mt-6">
        <CardTitle>Direct sponsored IDs</CardTitle>
        <Card className="mt-3" tone="info">
          <p className="tabular text-sm font-medium">
            {d.directs.count} / {d.directs.required}
            {d.directs.count >= d.directs.required ? " · Level 1 complete" : " · needed for Level 1"}
          </p>
          {d.directs.members.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Share this ID’s referral to sponsor direct IDs.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {d.directs.members.map((m) => (
                <li key={m.member_id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.display_name}</p>
                    <p className="font-mono text-xs text-muted">{m.member_id}</p>
                    <p className="text-xs text-muted">
                      {packageLabel(m.package_id)} · {formatDate(m.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
          {d.directs.hasMore ? <p className="mt-2 text-xs text-muted">More directs are listed on the network page.</p> : null}
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Earnings on this ID</CardTitle>
          <Link to="/app/earnings" search={{ id: d.id }} className="text-sm font-medium text-accent">
            Account earnings
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card tone="held">
            <CardKicker tone="held">Held commission</CardKicker>
            <div className="mt-2">
              <Money amount={d.wallet.held} size="lg" className="text-held" />
            </div>
            <p className="mt-1 text-[13px] leading-snug text-muted">Not withdrawable until the level completes.</p>
          </Card>
          <Card tone="success">
            <CardKicker tone="success">Released</CardKicker>
            <div className="mt-2">
              <Money amount={d.wallet.released} size="lg" className="text-success" />
            </div>
          </Card>
          <Card tone="available">
            <CardKicker tone="available">Available</CardKicker>
            <div className="mt-2">
              <Money amount={d.wallet.available} size="lg" className="text-accent" />
            </div>
          </Card>
        </div>
        <div className="mt-3 space-y-2">
          {d.commissions.length === 0 ? (
            <p className="text-sm text-muted">No commission entries on this ID yet.</p>
          ) : (
            d.commissions.map((c) => (
              <Card key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Level {c.level}</p>
                  <p className="font-mono text-xs text-muted">From {c.source_id}</p>
                  <p className="text-xs text-muted">{formatDateTime(c.held_at)}</p>
                </div>
                <div className="text-right">
                  <Money amount={c.commission_amount} size="sm" />
                  <div className="mt-1">
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <CardTitle>Network</CardTitle>
        <p className="mt-1 text-sm text-muted">Directs are listed above. Open the network page for downline depth on this ID only.</p>
        <Link to="/app/team" search={{ id: d.id }} className="mt-3 inline-flex">
          <Button variant="outline" size="sm">
            View network for {d.id}
          </Button>
        </Link>
      </section>

      <div className="mt-6">
        <IdScopedLinks memberId={d.id} />
      </div>
    </div>
  );
}

function IdHeader({
  detail,
  link,
  graduated,
}: {
  detail: {
    id: string;
    package_id: string;
    is_root: boolean;
    origin_kind: string;
    progression_status: string;
    referral_code: string | null;
  };
  link: string;
  graduated: boolean;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  const text = useMemo(() => {
    if (!detail.referral_code) return "";
    return `Join me on Link Mate. Referral for ${detail.id}: ${detail.referral_code}. ${link}`;
  }, [detail.id, detail.referral_code, link]);

  return (
    <Card tone="info">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker text-info">Viewing Membership ID</p>
          <p className="mt-1 break-all font-mono text-xl font-semibold">{detail.id}</p>
          <p className="mt-1 text-[15px] text-muted">
            {packageLabel(detail.package_id)} · {originLabel(detail)}
          </p>
        </div>
        <StatusBadge status={graduated ? "GRADUATED" : detail.progression_status} />
      </div>
      {detail.referral_code ? (
        <div className="mt-4 border-t border-border/70 pt-4">
          <p className="kicker text-muted">Referral for {detail.id}</p>
          <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-tight">{detail.referral_code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={detail.referral_code} label="Copy code" />
            {link ? <CopyButton value={link} label="Copy link" variant="secondary" /> : null}
            {canShare && link ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.share({ title: "Link Mate", text, url: link })}
              >
                Share
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}