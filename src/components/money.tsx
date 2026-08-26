import { formatBdt } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({
  amount,
  className,
  size = "md",
}: {
  amount: number | string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl sm:text-2xl",
    xl: "text-[1.75rem] leading-none sm:text-3xl",
  };
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap font-semibold tracking-tight",
        sizes[size],
        className,
      )}
    >
      {formatBdt(amount)}
    </span>
  );
}
