import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getInvite } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { QrCode } from "@/components/qr-code";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/app/invite")({ component: Invite });

function Invite() {
  const q = useQuery({ queryKey: ["invite"], queryFn: () => getInvite() });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  const link = useMemo(() => {
    if (!q.data) return "";
    return `${origin}/signup?ref=${encodeURIComponent(q.data.referralCode)}`;
  }, [origin, q.data]);

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;

  const text = `Join me on Link Mate. Referral ${q.data.referralCode}${q.data.activeId ? ` · ID ${q.data.activeId}` : ""}. ${link}`;

  return (
    <div>
      <PageHeader title="Invite" hint="Your referral attaches the new member’s first ID to you — not every ID in a multi-ID package." />
      <Card className="flex flex-col items-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Referral code</p>
        <p className="mt-2 font-mono text-3xl font-semibold tracking-tight">{q.data.referralCode}</p>
        {q.data.activeId ? <p className="mt-1 font-mono text-xs text-muted">{q.data.activeId}</p> : null}
        <div className="mt-6 rounded-2xl bg-surface-2 p-3">
          <QrCode value={link || q.data.referralCode} />
        </div>
        <p className="mt-4 max-w-xs break-all text-center text-xs text-muted">{link}</p>
        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <CopyButton value={link} label="Copy link" />
          <CopyButton value={q.data.referralCode} label="Copy code" variant="secondary" />
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
            href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(origin || "https://linkmate.app")}`}
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
      </Card>
    </div>
  );
}
