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
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-info px-6 py-12 text-center shadow-[0_0_0_1px_var(--color-border-info)]">
      {icon ? <div className="mb-4 text-muted">{icon}</div> : null}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{body}</p>
      {action && actionTo ? (
        <Link to={actionTo} className="mt-5">
          <Button>{action}</Button>
        </Link>
      ) : null}
    </div>
  );
}
