import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeam, simulateDirectJoin, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Modal } from "@/components/modal";
import { IdSwitcher, IdScopedLinks } from "@/components/id-switcher";
import { formatDate, packageLabel } from "@/lib/format";
import { parseMemberIdSearch, progressNounShort } from "@/lib/id-workspace";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  validateSearch: parseMemberIdSearch,
  component: Team,
});

function Team() {
  const qc = useQueryClient();
  const { id } = Route.useSearch();
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const selected = id ?? ids.data?.[0]?.id;
  const team = useQuery({
    queryKey: ["team", selected],
    queryFn: () => getTeam({ data: selected ? { memberId: selected } : {} }),
    enabled: Boolean(selected) || (ids.isSuccess && (ids.data?.length ?? 0) === 0),
  });
  const [openDepth, setOpenDepth] = useState<number | null>(1);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState("");

  const join = useMutation({
    mutationFn: () =>
      simulateDirectJoin({
        data: { sponsorMemberId: sponsor, name },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries();
      toast.success(`${res.memberId} joined under ${sponsor}`);
      setSheet(false);
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ids.isPending || team.isPending) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (team.isError) return <QueryError error={team.error} retry={() => team.refetch()} />;
  if (!team.data.activeId) {
    return (
      <div>
        <PageHeader title="Network" />
        <EmptyState
          title="No network yet"
          body="Direct and downline IDs appear here for the Membership ID you open. Choose a package to issue your first ID."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const membersByDepth = new Map<number, typeof team.data.members>();
  for (const m of team.data.members) {
    const list = membersByDepth.get(m.generation) ?? [];
    list.push(m);
    membersByDepth.set(m.generation, list);
  }
  const depths = [...membersByDepth.keys()].sort((a, b) => a - b);

  return (
    <div>
      <PageHeader
        title="Network"
        hint={
          ids.data ? (
            <IdSwitcher ids={ids.data} selectedId={team.data.activeId} onSelectPath="/app/team" />
          ) : (
            `Viewing ${team.data.activeId}`
          )
        }
        action={
          team.data.flags.simulateJoins ? (
            <Button
              size="sm"
              onClick={() => {
                const mine = ids.data ?? [];
                setSponsor(team.data.activeId ?? mine[0]?.id ?? "");
                setSheet(true);
              }}
            >
              Simulate join
            </Button>
          ) : undefined
        }
      />

      <p className="mb-4 text-sm text-muted">
        This list is for {team.data.activeId} only. Direct IDs count toward Level 1. Network depth is informational — it is not the level requirement.
      </p>

      <CardTitle>Direct sponsored IDs</CardTitle>
      <Card className="mt-3" tone="info">
        <p className="tabular text-sm font-medium">{team.data.directs.length} direct IDs</p>
        {team.data.directs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No direct sponsored IDs on this Membership ID yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {team.data.directs.map((m) => (
              <li key={m.member_id} className="flex items-start justify-between gap-3 py-3">
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
      </Card>

      <div className="mt-6">
        <CardTitle>Level progress on this ID</CardTitle>
        <div className="mt-3 space-y-2">
          {team.data.levels.map((lvl) => (
            <Card key={lvl.level} tone={lvl.status === "LOCKED" ? "default" : "progress"}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Level {lvl.level} · {progressNounShort(lvl.level)}
                </p>
                <StatusBadge status={lvl.status} />
              </div>
              <p className="mt-1 tabular text-sm text-muted">
                {lvl.completed_members} / {lvl.required_members}
              </p>
              <ProgressBar className="mt-2" value={lvl.completed_members} max={lvl.required_members} />
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CardTitle>Downline · network depth</CardTitle>
        <p className="mt-1 text-sm text-muted">Depth describes tree position. It does not decide which level an ID is working on.</p>
        <div className="mt-3 space-y-2">
          {depths.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">Downline IDs appear here as this Membership ID’s network grows.</p>
            </Card>
          ) : (
            depths.map((depth) => {
              const members = membersByDepth.get(depth) ?? [];
              const open = openDepth === depth;
              return (
                <div key={depth} className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-4 text-left"
                    onClick={() => setOpenDepth(open ? null : depth)}
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Network depth {depth}</p>
                      <p className="mt-0.5 tabular text-sm text-muted">{members.length} downline IDs</p>
                    </div>
                  </button>
                  {open ? (
                    <div className="border-t border-border px-4 py-3">
                      <ul className="divide-y divide-border">
                        {members.map((m) => (
                          <li key={m.member_id} className="flex items-start justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{m.display_name}</p>
                              <p className="font-mono text-xs text-muted">{m.member_id}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {packageLabel(m.package_id)} · {formatDate(m.created_at)}
                              </p>
                              <p className="font-mono text-xs text-muted">Sponsor {m.sponsor_id ?? "—"}</p>
                            </div>
                            <StatusBadge status={m.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {team.data.hasMore ? (
            <p className="text-xs text-muted">Showing the first part of this ID’s downline. Deeper history stays on the server.</p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-center text-sm">
        <Link to="/app/levels" search={{ id: team.data.activeId }} className="font-medium text-accent">
          Open level progress
        </Link>
      </p>
      <div className="mt-4">
        <IdScopedLinks memberId={team.data.activeId} />
      </div>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Simulate a member join">
        <p className="mb-4 text-sm text-muted">
          Creates a Builder ID under one of your IDs so you can test commission, hold, and release.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sp">Sponsor ID</Label>
            <select
              id="sp"
              className="h-11 w-full rounded-[12px] bg-surface px-3.5 text-sm shadow-[0_0_0_1px_var(--color-border)]"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
            >
              {(ids.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.id}
                  {row.is_root ? " · root" : " · internal"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="nm">Member name</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rafi Ahmed" />
          </div>
          <Button className="w-full" disabled={join.isPending || name.trim().length < 2} onClick={() => join.mutate()}>
            {join.isPending ? "Adding…" : "Add member"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}