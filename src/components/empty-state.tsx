import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
  actionTo,
  icon,
}: {
  title: string;
  body: string;
  action?: string;
  actionTo?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]">
      {icon ? <div className="mb-4 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action && actionTo ? (
        <Link to={actionTo} className="mt-5">
          <Button>{action}</Button>
        </Link>
      ) : null}
    </div>
  );
}
