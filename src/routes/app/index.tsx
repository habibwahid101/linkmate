import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, loadSampleNetwork } from "@/lib/server/member";
import { LevelKpi } from "@/components/level-card";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { MembershipIdCard, MembershipIdRow } from "@/components/membership-id-card";
import { AccountAvatar } from "@/components/avatar";
import { LocalDate } from "@/components/local-date";
import { formatBdt } from "@/lib/money";
import { PACKAGES } from "@/lib/rules";
import { DASHBOARD_ID_PREVIEW, usesCompactList } from "@/lib/id-workspace";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import type { PackageId } from "@/lib/rules";
import type { AppProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/app/")({ component: Home });

function IdentityCard({ profile }: { profile: AppProfile }) {
  const t = useT();
  return (
    <Card className="mb-4 flex items-center gap-3 p-4 sm:gap-4">
      <AccountAvatar name={profile.displayName} src={profile.avatarData} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t("dash.holder")}</p>
        <p className="truncate text-lg font-semibold tracking-tight">{profile.displayName}</p>
        <p className="mt-0.5 truncate font-mono text-sm text-muted">
          {t("dash.accountCode")} · {profile.referralCode}
        </p>
        <p className="mt-0.5 truncate font-mono text-sm text-accent">
          {t("dash.membershipId")} · {profile.activeId ?? t("dash.none")}
        </p>
      </div>
      <Link to="/app/profile" className="shrink-0 text-sm font-medium text-accent">
        {t("profile.photo")}
      </Link>
    </Card>
  );
}

function Home() {
  const t = useT();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const sample = useMutation({
    mutationFn: () => loadSampleNetwork(),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Turbo sample network loaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;
  const d = dash.data;
  const pkg = d.latestPackage ? PACKAGES[d.latestPackage as PackageId] : null;

  if (d.ids.length === 0) {
    return (
      <div>
        <PageHeader
          title={`${t("dash.hello")} ${d.profile.displayName}`}
          hint={t("dash.emptyHint")}
        />
        <IdentityCard profile={d.profile} />
        <EmptyState
          title={t("dash.emptyTitle")}
          body={
            d.flags.demoNetwork
              ? "Choose a package to issue IDs, or load a Turbo sample to inspect hold and release."
              : d.flags.manualPayments
                ? "Choose a package and submit a manual payment. IDs are issued only after admin verification."
                : d.flags.paymentsMode === "disabled"
                ? "Online payment is not available yet. Package details can still be reviewed."
                : "Choose a package to issue Membership IDs. Each ID progresses and earns independently."
          }
          action={t("pkg.title")}
          actionTo="/app/packages"
        />
        {d.flags.demoNetwork ? (
          <Button
            className="mt-4 w-full sm:w-auto"
            variant="outline"
            disabled={sample.isPending}
            onClick={() => sample.mutate()}
          >
            {sample.isPending ? "Loading sample…" : "Load Turbo sample network"}
          </Button>
        ) : null}
      </div>
    );
  }

  const preview = d.ids.slice(0, DASHBOARD_ID_PREVIEW);
  const compact = usesCompactList(d.ids.length);

  return (
    <div>
      <PageHeader title={t("dash.title")} hint={t("dash.hint")} />
      <IdentityCard profile={d.profile} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LevelKpi
          tone="info"
          label={t("dash.ids")}
          value={<span className="tabular text-xl font-semibold tracking-tight">{d.idCount}</span>}
          hint={pkg ? `${pkg.name} · ${pkg.idCount} issued` : "Owned by this account"}
        />
        <LevelKpi
          tone="available"
          label={t("dash.available")}
          value={<Money amount={d.wallet.available} size="lg" className="text-accent" />}
          hint="Account total · withdrawable"
        />
        <LevelKpi
          tone="held"
          label={t("dash.held")}
          value={<Money amount={d.wallet.held} size="lg" className="text-held" />}
          hint="Account total · not withdrawable"
        />
        <LevelKpi
          tone="success"
          label={t("dash.released")}
          value={<Money amount={d.wallet.released} size="lg" className="text-success" />}
          hint="Account lifetime released"
        />
        <LevelKpi
          tone="progress"
          label={t("dash.highest")}
          value={
            <span className="tabular text-xl font-semibold tracking-tight">
              {d.highestActiveLevel ? `Level ${d.highestActiveLevel}` : "—"}
            </span>
          }
          hint="Highest current level among owned IDs"
        />
        <LevelKpi
          tone="progress"
          label={t("dash.inProgress")}
          value={<span className="tabular text-xl font-semibold tracking-tight">{d.idsInProgress}</span>}
          hint={d.graduatedCount ? `${d.graduatedCount} graduated` : "Not yet graduated"}
        />
        <LevelKpi
          tone="package"
          label={t("dash.latest")}
          value={<span className="text-xl font-semibold tracking-tight">{pkg?.name ?? "—"}</span>}
          hint={pkg ? formatBdt(pkg.amountBdt) : undefined}
        />
        <LevelKpi
          tone="info"
          label={t("dash.activeId")}
          value={
            <span className="truncate font-mono text-lg font-semibold tracking-tight">
              {d.profile.activeId ?? t("dash.none")}
            </span>
          }
          hint={t("dash.membershipId")}
        />
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <CardTitle>{t("dash.myIds")}</CardTitle>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{t("dash.myIdsHint")}</p>
        </div>
        <Link to="/app/ids" className="shrink-0 text-sm font-medium text-accent">
          {t("dash.manage")}
        </Link>
      </div>

      <div className="mt-3 space-y-3">
        {compact
          ? preview.map((row) => <MembershipIdRow key={row.id} row={row} />)
          : preview.map((row) => <MembershipIdCard key={row.id} row={row} compact={d.ids.length > 1} />)}
        {d.ids.length > DASHBOARD_ID_PREVIEW ? (
          <p className="text-center text-sm text-muted">
            Showing {DASHBOARD_ID_PREVIEW} of {d.ids.length}.{" "}
            <Link to="/app/ids" className="font-medium text-accent">
              {t("dash.myIds")}
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>{t("dash.releases")}</CardTitle>
          <Link to="/app/wallet" className="text-sm font-medium text-accent">
            {t("dash.wallet")}
          </Link>
        </div>
        <Card tone="success">
          <p className="text-[15px] leading-relaxed text-muted">Account-wide ledger. Open an ID to see only that ID’s earnings.</p>
          {d.recentTx.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Released earnings appear after a level completes on an ID.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.recentTx.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tx.source}</p>
                    <p className="font-mono text-xs text-muted">
                      {tx.member_id}
                      {tx.level ? ` · Level ${tx.level}` : ""}
                    </p>
                    <LocalDate className="text-xs text-muted" iso={tx.created_at} />
                  </div>
                  <Money amount={tx.amount} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
