import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetSettings, adminUpdateSetting } from "@/lib/server/admin";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (p: { key: string; value: string }) =>
      adminUpdateSetting({ data: { key: p.key, value: p.value, confirm: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Setting updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Settings"
        hint="standard_id_value_bdt is locked. First-account admin bootstrap is preview-only (not production)."
      />
      <div className="space-y-3">
        {q.data.settings.map((s) => {
          const locked =
            s.key === "standard_id_value_bdt" || s.key === "rule_version" || s.key === "bootstrap_admin";
          const value = draft[s.key] ?? s.value;
          return (
            <Card key={s.key}>
              <p className="font-mono text-xs text-muted">{s.key}</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={value}
                  disabled={locked}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                />
                <Button
                  disabled={locked || save.isPending || value === s.value}
                  onClick={() => save.mutate({ key: s.key, value })}
                >
                  Save
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
