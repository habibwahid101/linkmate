import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[12px] bg-surface px-3.5 text-sm text-ink shadow-[0_0_0_1px_var(--color-border)] placeholder:text-subtle",
        "transition-[box-shadow] duration-150",
        "focus:shadow-[0_0_0_2px_var(--color-accent)] focus:outline-none",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium tracking-wide text-muted", className)}
      {...props}
    />
  );
}
