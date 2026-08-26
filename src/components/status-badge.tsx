import { Badge } from "@/components/ui/badge";
import type { LevelStatus } from "@/lib/rules";

const map: Record<string, { tone: "neutral" | "accent" | "success" | "warning" | "held" | "locked" | "danger"; label: string }> = {
  LOCKED: { tone: "locked", label: "Locked" },
  IN_PROGRESS: { tone: "accent", label: "In Progress" },
  ELIGIBLE: { tone: "warning", label: "Eligible" },
  COMPLETED: { tone: "success", label: "Completed" },
  RELEASED: { tone: "success", label: "Released" },
  REVERSED: { tone: "danger", label: "Reversed" },
  PENDING: { tone: "held", label: "Pending" },
  active: { tone: "success", label: "Active" },
  placed: { tone: "accent", label: "Placed" },
  pending_config: { tone: "warning", label: "Unplaced" },
  posted: { tone: "success", label: "Posted" },
  completed: { tone: "success", label: "Completed" },
};

export function StatusBadge({ status }: { status: string | LevelStatus }) {
  const m = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
