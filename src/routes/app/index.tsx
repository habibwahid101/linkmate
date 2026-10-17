import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, loadSampleNetwork } from "@/lib/server/member";
import { updateMyProfile } from "@/lib/server/profile";
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
import { designationSummary } from "@/lib/engine/designations";
import { formatBdt } from "@/lib/money";
import { PACKAGES } from "@/lib/rules";
import { DASHBOARD_ID_PREVIEW, usesCompactList } from "@/lib/id-workspace";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import type { PackageId } from "@/lib/rules";
import type { AppProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/app/")({ component: Home });

async function readAvatarFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is too large");
  const bitmap = await createImageBitmap(file);
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.82);
  if (data.length > 180_000) throw new Error("Image is too large");
  return data;
}

function HolderAvatar({ profile }: { profile: AppProfile }) {
  const t = useT();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const avatarData = await readAvatarFile(file);
      await updateMyProfile({ data: { avatarData } });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["shell"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("profile.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative shrink-0">
      <AccountAvatar name={profile.displayName} src={profile.avatarData} size="lg" />
      <button
        type="button"
        aria-label={t("profile.photo")}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)] ring-2 ring-surface disabled:opacity-60"
      >
        <Camera className="size-3.5" strokeWidth={1.75} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </div>
  );
}

function IdentityCard({ profile, designation }: { profile: AppProfile; designation?: string | null }) {
  const t = useT();
  return (
    <Card className="mb-4 flex items-center gap-3 p-4 sm:gap-4">
      <HolderAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t("dash.holder")}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-lg font-semibold tracking-tight">{profile.displayName}</p>
          {designation ? (
            <p className="shrink-0 text-right text-sm font-semibold">{designation}</p>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-sm text-muted">
          {t("dash.accountCode")} · {profile.referralCode}
        </p>
        <p className="mt-0.5 truncate font-mono text-sm text-accent">
          {t("dash.membershipId")} · {profile.activeId ?? t("dash.none")}
        </p>
      </div>
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
  const active =
    d.ids.find((row) => row.id === d.profile.activeId) ??
    d.ids.find((row) => row.is_root) ??
    d.ids[0];
  const designation = designationSummary(active?.designationCount ?? 0);

  return (
    <div>
      <PageHeader title={t("dash.title")} hint={t("dash.hint")} />
      <IdentityCard profile={d.profile} designation={designation.label} />

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
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    <th className="pb-2 pr-3 font-semibold">Source</th>
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Date</th>
                    <th className="pb-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentTx.map((tx) => (
                    <tr key={tx.id} className="border-t border-border/70">
                      <td className="py-2.5 pr-3 text-sm font-medium">
                        {tx.source}
                        {tx.level ? <span className="mt-0.5 block text-xs font-normal text-muted">Level {tx.level}</span> : null}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted">{tx.member_id}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted">
                        <LocalDate iso={tx.created_at} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Money amount={tx.amount} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
