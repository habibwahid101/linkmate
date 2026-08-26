import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  neutral: "bg-surface-2 text-ink",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  held: "bg-held-soft text-held",
  danger: "bg-danger-soft text-danger",
  locked: "bg-surface-2 text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
