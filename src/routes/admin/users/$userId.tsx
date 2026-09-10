import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetUser, adminSetRole } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { formatBdt, toInt } from "@/lib/money";
import { formatDate, packageLabel } from "@/lib/format";
import { toast } from "sonner";
import { publicErrorMessage } from "@/lib/public-error";
import { cn } from "@/lib/utils";
import { evaluateLandQualification } from "@/lib/qualification";

export const Route = createFileRoute("/admin/users/$userId")({ component: UserDetail });

function UserDetail() {
  const { userId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => adminGetUser({ data: { userId } }) });
  const role = useMutation({
    mutationFn: (next: "member" | "admin") => adminSetRole({ data: { userId, role: next, confirm: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(publicErrorMessage(e)),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const { user, ids, account, wallet, purchases, payments } = q.data;
  return (
    <div>
      <PageHeader
        title={user.display_name}
        hint="Account identity. Membership IDs below are engine-owned facts — sponsor, level, and wallet cannot be edited here."
      />
      <Card className="space-y-3" tone="info">
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="Role" value={user.locked ? `${user.role} · locked` : user.role} />
        <Row label="Account referral" value={user.referral_code} />
        <Row label="Status" value={user.is_synthetic ? "Simulated" : "Member account"} />
        <Row label="Joined" value={formatDate(user.created_at)} />
        <Row label="Owned IDs" value={String(ids.length)} />
      </Card>
      {!user.locked ? (
        <Button
          className="mt-3"
          variant="outline"
          disabled={role.isPending}
          onClick={() => {
            const next = user.role === "admin" ? "member" : "admin";
            if (typeof window !== "undefined" && !window.confirm(`Change ${user.display_name} to ${next}?`)) return;
            role.mutate(next);
          }}
        >
          {user.role === "admin" ? "Demote to member" : "Promote to admin"}
        </Button>
      ) : (
        <p className="mt-3 text-sm text-muted">Locked platform operator. Role cannot be changed.</p>
      )}

      <h2 className="mt-8 text-sm font-semibold">Account wallet</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Card tone="available">
          <p className="text-xs uppercase tracking-wider text-muted">Available</p>
          <Money className="mt-2" amount={wallet.available} size="lg" />
        </Card>
        <Card tone="held">
          <p className="text-xs uppercase tracking-wider text-muted">Held</p>
          <Money className="mt-2" amount={wallet.held} size="lg" />
        </Card>
        <Card tone="success">
          <p className="text-xs uppercase tracking-wider text-muted">Released</p>
          <Money className="mt-2" amount={wallet.released} size="lg" />
        </Card>
      </div>
      <p className="mt-2 text-xs text-muted">
        {account.idCount} Membership IDs · {account.idsInProgress} in progress · {account.graduatedCount} graduated
      </p>

      <h2 className="mt-8 text-sm font-semibold">Owned Membership IDs</h2>
      <div className="mt-3 space-y-2">
        {ids.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">This account does not own any Membership IDs.</Card>
        ) : (
          ids.map((id) => {
            const land = evaluateLandQualification({
              hasMembership: id.status === "active",
              directSponsors: id.directSponsors,
              completedLevels: id.completedLevels,
              level9Released: id.level9Released,
            });
            return (
              <button
                key={id.id}
                type="button"
                className="block w-full text-left"
                onClick={() => nav({ to: "/admin/ids/$memberId", params: { memberId: id.id } })}
              >
                <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{id.id}</p>
                    <p className="text-xs text-muted">
                      {packageLabel(id.package_id)} · Level {id.current_level} · Direct IDs {id.directSponsors}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={id.status} />
                    <Badge tone={land.qualified ? "success" : "held"}>{land.status}</Badge>
                  </div>
                </Card>
              </button>
            );
          })
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Purchases</h2>
      <div className="mt-3 space-y-2">
        {purchases.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">No package purchases on this account.</Card>
        ) : (
          purchases.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{packageLabel(p.package_id)}</p>
                <p className="text-xs text-muted">
                  {p.id_count} IDs · {formatDate(p.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-semibold">{formatBdt(toInt(p.amount_bdt))}</p>
                <StatusBadge status={p.payment_status} />
              </div>
            </Card>
          ))
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold">Payments</h2>
      <div className="mt-3 space-y-2">
        {payments.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">No payment requests on this account.</Card>
        ) : (
          payments.map((p) => (
            <Link key={p.id} to="/admin/payments/$id" params={{ id: p.id }} className="block">
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{packageLabel(p.package_id)}</p>
                  <p className="text-xs text-muted">{formatDate(p.created_at)}</p>
                </div>
                <StatusBadge status={p.status} />
              </Card>
            </Link>
          ))
        )}
      </div>

      <Link to="/admin/users" className={cn(buttonVariants({ variant: "ghost" }), "mt-4")}>
        Back to accounts
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[60%] break-all text-right text-sm font-medium">{value}</span>
    </div>
  );
}
