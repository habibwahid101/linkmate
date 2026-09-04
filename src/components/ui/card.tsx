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
  info: "bg-surface-info shadow-[0_0_0_1px_var(--color-border-info)] before:bg-info",
  success: "bg-surface-success shadow-[0_0_0_1px_var(--color-border-success)] before:bg-success",
  progress: "bg-surface-progress shadow-[0_0_0_1px_var(--color-border-progress)] before:bg-progress",
  held: "bg-surface-held shadow-[0_0_0_1px_var(--color-border-held)] before:bg-held",
  package: "bg-surface-package shadow-[0_0_0_1px_var(--color-border-package)] before:bg-package",
  warning: "bg-warning-soft shadow-[0_0_0_1px_var(--color-border-warning)] before:bg-warning",
  error: "bg-danger-soft shadow-[0_0_0_1px_var(--color-border-error)] before:bg-danger",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-surface p-4 text-ink shadow-[var(--shadow-card)] sm:p-5",
        tone !== "default" &&
          "before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:rounded-full before:content-[''] sm:before:bottom-4 sm:before:top-4",
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
