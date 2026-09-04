import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type CardTone =
  | "default"
  | "info"
  | "success"
  | "progress"
  | "held"
  | "package"
  | "warning"
  | "error";

const TONE: Record<CardTone, string> = {
  default: "bg-surface shadow-[var(--shadow-card)]",
  info: "bg-surface-info shadow-[0_0_0_1px_var(--color-border-info)]",
  success: "bg-surface-success shadow-[0_0_0_1px_var(--color-border-success)]",
  progress: "bg-surface-progress shadow-[0_0_0_1px_var(--color-border-progress)]",
  held: "bg-surface-held shadow-[0_0_0_1px_var(--color-border-held)]",
  package: "bg-surface-package shadow-[0_0_0_1px_var(--color-border-package)]",
  warning: "bg-warning-soft shadow-[0_0_0_1px_var(--color-border-warning)]",
  error: "bg-danger-soft shadow-[0_0_0_1px_var(--color-border-error)]",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-surface p-4 text-ink shadow-[var(--shadow-card)] sm:p-5",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
