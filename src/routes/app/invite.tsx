import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getInvite, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { QrCode } from "@/components/qr-code";
import { IdSwitcher, IdScopedLinks } from "@/components/id-switcher";
import { parseMemberIdSearch } from "@/lib/id-workspace";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/app/invite")({
  validateSearch: parseMemberIdSearch,
  component: Invite,
});

function Invite() {
  const { id } = Route.useSearch();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const selected = id ?? ids.data?.[0]?.id;
  const q = useQuery({
    queryKey: ["invite", selected],
    queryFn: () => getInvite({ data: selected ? { memberId: selected } : {} }),
    enabled: Boolean(selected) || (ids.isSuccess && (ids.data?.length ?? 0) === 0),
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  const link = useMemo(() => {
    if (!q.data?.selected) return "";
    return `${origin}/signup?ref=${encodeURIComponent(q.data.selected.referralCode)}`;
  }, [origin, q.data]);

  if (ids.isPending || q.isPending) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;

  if (!q.data.selected) {
    return (
      <div>
        <PageHeader title="Invite" hint="Each Membership ID has its own referral code." />
        <EmptyState
          title="Activate a Membership ID to start inviting"
          body="Invite links become operational only after a Membership ID is issued. Choose which ID you want to share from My IDs."
          action="Choose a package"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const sel = q.data.selected;
  const text = `Join me on Link Mate. Referral for ${sel.memberId}: ${sel.referralCode}. ${link}`;

  return (
    <div>
      <PageHeader
        title="Invite"
        hint={
          ids.data && ids.data.length > 0 ? (
            <IdSwitcher ids={ids.data} selectedId={sel.memberId} onSelectPath="/app/invite" />
          ) : (
            `Referral for ${sel.memberId}`
          )
        }
      />
      <Card className="flex flex-col items-center" tone="info">
        <p className="kicker text-info">Referral for {sel.memberId}</p>
        <p className="mt-2 break-all font-mono text-3xl font-semibold tracking-tight">{sel.referralCode}</p>
        <p className="mt-1 font-mono text-[13px] text-muted">{sel.memberId}</p>
        <div className="mt-6 rounded-2xl bg-surface-2 p-3">
          <QrCode value={link || sel.referralCode} />
        </div>
        <p className="mt-4 max-w-xs break-all text-center text-[13px] text-muted">{link}</p>
        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <CopyButton value={link} label="Copy link" />
          <CopyButton value={sel.referralCode} label="Copy code" variant="secondary" />
        </div>
        <div className="mt-2 grid w-full grid-cols-2 gap-2">
          <a
            className="inline-flex h-11 items-center justify-center rounded-[12px] bg-surface-2 text-sm font-medium"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <a
            className="inline-flex h-11 items-center justify-center rounded-[12px] bg-surface-2 text-sm font-medium"
            href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(origin)}`}
            target="_blank"
            rel="noreferrer"
          >
            Messenger
          </a>
        </div>
        {canShare ? (
          <Button
            className="mt-2 w-full"
            variant="outline"
            onClick={() => void navigator.share({ title: "Link Mate", text, url: link })}
          >
            Share
          </Button>
        ) : null}
        <p className="mt-4 text-center text-[13px] leading-relaxed text-muted">
          This code sponsors {sel.memberId} only — not every ID on the account.{" "}
          <Link to="/app/ids" className="text-accent">
            Choose a different ID
          </Link>
        </p>
      </Card>
      <div className="mt-6">
        <IdScopedLinks memberId={sel.memberId} />
      </div>
    </div>
  );
}