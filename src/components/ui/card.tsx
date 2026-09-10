import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type CardTone =
  | "default"
  | "info"
  | "success"
  | "available"
  | "progress"
  | "held"
  | "package"
  | "warning"
  | "error";

const TONE: Record<CardTone, string> = {
  default: "bg-surface shadow-[var(--shadow-card)]",
  info: "bg-surface-info shadow-[0_0_0_1px_var(--color-border-info)]",
  success: "bg-surface-success shadow-[0_0_0_1px_var(--color-border-success)]",
  available: "bg-surface-available shadow-[0_0_0_1px_var(--color-border-available)]",
  progress: "bg-surface-progress shadow-[0_0_0_1px_var(--color-border-progress)]",
  held: "bg-surface-held shadow-[0_0_0_1px_var(--color-border-held)]",
  package: "bg-surface-package shadow-[0_0_0_1px_var(--color-border-package)]",
  warning: "bg-warning-soft shadow-[0_0_0_1px_var(--color-border-warning)]",
  error: "bg-danger-soft shadow-[0_0_0_1px_var(--color-border-error)]",
};

export const KICKER: Record<CardTone, string> = {
  default: "text-muted",
  info: "text-info",
  success: "text-success",
  available: "text-accent",
  progress: "text-progress",
  held: "text-held",
  package: "text-package",
  warning: "text-warning",
  error: "text-danger",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
      className={cn("rounded-2xl p-4 text-ink sm:p-5", TONE[tone], className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-[15px] leading-relaxed text-muted", className)} {...props} />;
}

export function CardKicker({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { tone?: CardTone }) {
  return <p className={cn("kicker", KICKER[tone], className)} {...props} />;
}
