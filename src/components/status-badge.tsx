import { Badge } from "@/components/ui/badge";
import type { LevelStatus } from "@/lib/rules";

const map: Record<
  string,
  {
    tone: "neutral" | "accent" | "success" | "warning" | "held" | "locked" | "danger" | "info" | "progress";
    label: string;
  }
> = {
  LOCKED: { tone: "locked", label: "Locked" },
  IN_PROGRESS: { tone: "progress", label: "In Progress" },
  ELIGIBLE: { tone: "warning", label: "Eligible" },
  COMPLETED: { tone: "success", label: "Completed" },
  RELEASED: { tone: "success", label: "Released" },
  HELD: { tone: "held", label: "Held" },
  REVERSED: { tone: "danger", label: "Reversed" },
  PENDING: { tone: "held", label: "Pending Verification" },
  NEEDS_REVIEW: { tone: "warning", label: "Needs Review" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  active: { tone: "success", label: "Active" },
  placed: { tone: "info", label: "Placed" },
  pending_config: { tone: "warning", label: "Unplaced" },
  posted: { tone: "success", label: "Posted" },
  completed: { tone: "success", label: "Completed" },
};

export function StatusBadge({ status }: { status: string | LevelStatus }) {
  const m = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
