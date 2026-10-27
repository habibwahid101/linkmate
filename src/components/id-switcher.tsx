import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { packageLabel } from "@/lib/format";
import { originLabel, idStatusLabel } from "@/lib/id-workspace";
import type { CompactMembershipId } from "@/lib/id-workspace";
import { cn } from "@/lib/utils";

function byMemberId(a: CompactMembershipId, b: CompactMembershipId) {
  return a.id.localeCompare(b.id, "en", { numeric: true });
}

function optionText(id: CompactMembershipId) {
  return `${id.id} · ${packageLabel(id.package_id)}${id.is_root ? " · Root" : ""} · L${id.current_level}${id.progression_status === "GRADUATED" ? " · Graduated" : ""}`;
}

export function IdSwitcher({
  ids,
  selectedId,
  onSelectPath,
}: {
  ids: CompactMembershipId[];
  selectedId: string;
  /** When set, changing the select navigates to this path with `?id=`. */
  onSelectPath?: "/app" | "/app/team" | "/app/levels" | "/app/invite" | "/app/qualification" | "/app/earnings";
}) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const ordered = [...ids].sort(byMemberId);
  const selected = ordered.find((id) => id.id === selectedId) ?? ordered[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!selected) return null;

  function choose(next: string) {
    setOpen(false);
    if (next === selectedId) return;
    if (onSelectPath) {
      void navigate({ to: onSelectPath, search: { id: next } });
      return;
    }
    void navigate({ to: "/app/ids/$memberId", params: { memberId: next } });
  }

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label id={`${listId}-label`} className="kicker shrink-0 text-muted">
        Viewing Membership ID
      </label>
      {ordered.length === 1 ? (
        <p className="break-all font-mono text-[15px] font-semibold text-ink">{selected.id}</p>
      ) : (
        <div className="relative min-w-0 sm:max-w-[22rem]">
          <button
            type="button"
            className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[12px] bg-surface px-3 text-left font-mono text-[13px] text-ink shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)] focus:outline-none"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-labelledby={`${listId}-label`}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="min-w-0 truncate">{optionText(selected)}</span>
            <span className="shrink-0 text-[11px] font-semibold text-muted">{ordered.length}</span>
          </button>
          {open ? (
            <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-[18rem] overflow-hidden rounded-[12px] bg-surface text-ink shadow-[0_0_0_1px_var(--color-border),var(--shadow-card)]">
              <p className="border-b border-border px-3 py-2 text-[12px] font-medium text-muted">
                {ordered.length} Membership IDs, in number order
              </p>
              <ul id={listId} role="listbox" aria-labelledby={`${listId}-label`} className="max-h-80 overflow-y-auto py-1">
                {ordered.map((id) => {
                  const active = id.id === selected.id;
                  return (
                    <li key={id.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-center px-3 py-2 text-left font-mono text-[13px] text-ink hover:bg-surface-2",
                          active && "bg-surface-2 font-semibold",
                        )}
                        onClick={() => choose(id.id)}
                      >
                        {optionText(id)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
      <p className="text-[13px] text-muted">
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
            className="inline-flex h-11 shrink-0 items-center rounded-full px-3 text-[15px] font-medium text-accent hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ) : (
          <Link
            key={item.label}
            to={item.to}
            search={{ id: memberId }}
            className="inline-flex h-11 shrink-0 items-center rounded-full px-3 text-[15px] font-medium text-accent hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}