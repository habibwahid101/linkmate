import { Link, useNavigate } from "@tanstack/react-router";
import { packageLabel } from "@/lib/format";
import { originLabel, idStatusLabel } from "@/lib/id-workspace";
import type { CompactMembershipId } from "@/lib/id-workspace";

export function IdSwitcher({
  ids,
  selectedId,
  onSelectPath,
}: {
  ids: CompactMembershipId[];
  selectedId: string;
  /** When set, changing the select navigates to this path with `?id=`. */
  onSelectPath?: "/app/team" | "/app/levels" | "/app/invite" | "/app/qualification" | "/app/earnings";
}) {
  const navigate = useNavigate();
  if (ids.length === 0) return null;
  const selected = ids.find((id) => id.id === selectedId) ?? ids[0]!;
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor="id-switcher" className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted">
        Viewing Membership ID
      </label>
      {ids.length === 1 ? (
        <p id="id-switcher" className="font-mono text-sm font-semibold">
          {selected.id}
        </p>
      ) : (
        <select
          id="id-switcher"
          className="h-11 min-w-0 max-w-full rounded-[12px] bg-surface px-3 font-mono text-xs shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)] focus:outline-none sm:max-w-[18rem]"
          value={selectedId}
          aria-label="Switch Membership ID"
          onChange={(e) => {
            const next = e.target.value;
            if (onSelectPath) {
              void navigate({ to: onSelectPath, search: { id: next } });
              return;
            }
            void navigate({ to: "/app/ids/$memberId", params: { memberId: next } });
          }}
        >
          {ids.map((id) => (
            <option key={id.id} value={id.id}>
              {id.id} · {packageLabel(id.package_id)}
              {id.is_root ? " · Root" : ""} · L{id.current_level}
              {id.progression_status === "GRADUATED" ? " · Graduated" : ""}
            </option>
          ))}
        </select>
      )}
      <p className="text-xs text-muted">
        {packageLabel(selected.package_id)} · {originLabel(selected)} · {idStatusLabel(selected)}
      </p>
    </div>
  );
}

export function IdScopedLinks({ memberId }: { memberId: string }) {
  const items = [
    { to: "/app/ids/$memberId" as const, label: "ID dashboard" },
    { to: "/app/levels" as const, label: "Progress" },
    { to: "/app/team" as const, label: "Network" },
    { to: "/app/invite" as const, label: "Referral" },
    { to: "/app/earnings" as const, label: "Earnings" },
  ];
  return (
    <nav aria-label="This Membership ID" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {items.map((item) =>
        item.to === "/app/ids/$memberId" ? (
          <Link
            key={item.label}
            to="/app/ids/$memberId"
            params={{ memberId }}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ) : (
          <Link
            key={item.label}
            to={item.to}
            search={{ id: memberId }}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
