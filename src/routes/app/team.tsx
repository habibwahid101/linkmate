import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeam, simulateDirectJoin, listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Modal } from "@/components/modal";
import { formatDate, packageLabel } from "@/lib/format";
import { ordinalGeneration } from "@/lib/rules";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/team")({ component: Team });

function Team() {
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => getTeam() });
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const [openGen, setOpenGen] = useState<number | null>(1);
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

  if (team.isPending) return <DashboardSkeleton />;
  if (team.isError) return <QueryError error={team.error} retry={() => team.refetch()} />;
  if (!team.data.activeId) {
    return (
      <div>
        <PageHeader title="Team" />
        <EmptyState
          title="No network yet"
          body="Your Level 2 progress will appear here as your network grows."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const membersByGen = new Map<number, typeof team.data.members>();
  for (const m of team.data.members) {
    const list = membersByGen.get(m.generation) ?? [];
    list.push(m);
    membersByGen.set(m.generation, list);
  }

  return (
    <div>
      <PageHeader
        title="Team"
        hint={`Active ${team.data.activeId}. Generations stay in their true position.`}
        action={
          team.data.flags.simulateJoins ? (
          <Button size="sm" onClick={() => {
            const mine = ids.data ?? [];
            const internal = mine.find((id) => !id.is_root);
            setSponsor(internal?.id ?? team.data.activeId ?? mine[0]?.id ?? "");
            setSheet(true);
          }}>
            Simulate join
          </Button>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {team.data.levels.map((lvl) => {
          const members = membersByGen.get(lvl.generation) ?? [];
          const open = openGen === lvl.generation;
          return (
            <div key={lvl.level} className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
              <button
                type="button"
                className="flex w-full items-center gap-3 p-4 text-left"
                onClick={() => setOpenGen(open ? null : lvl.generation)}
              >
                {open ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Level {lvl.level} · {ordinalGeneration(lvl.generation)} generation
                    </p>
                    <StatusBadge status={lvl.status} />
                  </div>
                  <p className="mt-1 tabular text-sm text-muted">
                    {lvl.completed_members} / {lvl.required_members}
                  </p>
                  <ProgressBar className="mt-2" value={lvl.completed_members} max={lvl.required_members} />
                </div>
              </button>
              {open ? (
                <div className="border-t border-border px-4 py-3">
                  {members.length === 0 ? (
                    <p className="py-4 text-sm text-muted">
                      {lvl.generation === 2
                        ? "Your Level 2 progress will appear here as your network grows."
                        : "No members in this generation yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {members.map((m) => (
                        <li key={m.member_id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{m.display_name}</p>
                            <p className="font-mono text-xs text-muted">{m.member_id}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {packageLabel(m.package_id)} · {formatDate(m.created_at)} · Sponsor {m.sponsor_id ?? "—"}
                            </p>
                          </div>
                          <StatusBadge status={m.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm">
        <Link to="/app/levels" className="font-medium text-accent">
          Open level progress
        </Link>
      </p>

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
              {(ids.data ?? []).map((id) => (
                <option key={id.id} value={id.id}>
                  {id.id}
                  {id.is_root ? " · root" : " · internal"}
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
