import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listMyIds } from "@/lib/server/member";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MembershipIdCard, MembershipIdRow } from "@/components/membership-id-card";
import {
  ID_FILTERS,
  ID_SORTS,
  filterAndSortIds,
  usesCompactList,
  type IdFilter,
  type IdSort,
} from "@/lib/id-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ids/")({ component: Ids });

function Ids() {
  const ids = useQuery({ queryKey: ["ids"], queryFn: () => listMyIds() });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<IdFilter>("all");
  const [sort, setSort] = useState<IdSort>("id");

  const visible = useMemo(
    () => filterAndSortIds(ids.data ?? [], { query, filter, sort }),
    [ids.data, query, filter, sort],
  );

  if (ids.isPending) return <DashboardSkeleton />;
  if (ids.isError) return <QueryError error={ids.error} retry={() => ids.refetch()} />;
  if (ids.data.length === 0) {
    return (
      <div>
        <PageHeader title="My Membership IDs" hint="Each ID is an independent business unit." />
        <EmptyState
          title="No Membership IDs yet"
          body="Choose a package to issue your first membership ID. Progress, referrals, and earnings will appear here."
          action="View packages"
          actionTo="/app/packages"
        />
      </div>
    );
  }

  const compact = usesCompactList(ids.data.length);

  return (
    <div>
      <PageHeader
        title="My Membership IDs"
        hint={`${ids.data.length} ID${ids.data.length === 1 ? "" : "s"} on this account. Open one to manage progress, referral, earnings, and network.`}
      />

      {ids.data.length > 1 ? (
        <div className="mb-4 space-y-3">
          <label className="block">
            <span className="sr-only">Search Membership IDs</span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, referral, or package"
              aria-label="Search Membership IDs"
            />
          </label>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter Membership IDs">
            {ID_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-sm font-medium",
                  filter === f.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-ink",
                )}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Sort</span>
            <select
              className="h-11 min-w-0 flex-1 rounded-[12px] bg-surface px-3 text-sm shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)] focus:outline-none sm:max-w-xs"
              value={sort}
              aria-label="Sort Membership IDs"
              onChange={(e) => setSort(e.target.value as IdSort)}
            >
              {ID_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted">No IDs match this filter.</p>
      ) : compact ? (
        <div className="space-y-2">
          {visible.map((row) => (
            <MembershipIdRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((row) => (
            <MembershipIdCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}