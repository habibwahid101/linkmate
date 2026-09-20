import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markNotificationRead } from "@/lib/server/profile";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/local-date";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/notifications")({ component: Notifications });

function Notifications() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications() });
  const mark = useMutation({
    mutationFn: (id?: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["shell"] });
    },
  });

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;

  return (
    <div>
      <PageHeader
        title={t("notes.title")}
        action={
          q.data.some((n) => !n.read) ? (
            <Button size="sm" variant="ghost" onClick={() => mark.mutate(undefined)}>
              {t("notes.mark")}
            </Button>
          ) : null
        }
      />
      {q.data.length === 0 ? (
        <EmptyState
          title="You’re all caught up"
          body="We’ll notify you when members join, levels complete, and commission releases to your wallet."
        />
      ) : (
        <ul className="space-y-2">
          {q.data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => !n.read && mark.mutate(n.id)}
                className={cn(
                  "w-full rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-card)]",
                  !n.read && "shadow-[0_0_0_1px_var(--color-accent)]",
                )}
              >
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
                <p className="mt-2 text-xs text-subtle"><LocalDate iso={n.created_at} time /></p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
