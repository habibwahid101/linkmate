import { Badge } from "@/components/ui/badge";
import { statusVisual } from "@/lib/admin-status";
import type { LevelStatus } from "@/lib/rules";

export function StatusBadge({ status }: { status: string | LevelStatus }) {
  const m = statusVisual(status);
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
