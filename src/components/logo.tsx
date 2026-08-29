import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={32}
      height={32}
      className={cn("size-8", className)}
      style={{ width: 32, height: 32, flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect
        width="32"
        height="32"
        rx="8"
        fill={invert ? "#F3F1EC" : "#1F4D45"}
      />
      <circle cx="10" cy="16" r="2.2" fill={invert ? "#1F4D45" : "#F3F1EC"} />
      <circle cx="22" cy="10" r="2.2" fill={invert ? "#1F4D45" : "#F3F1EC"} />
      <circle cx="22" cy="22" r="2.2" fill={invert ? "#1F4D45" : "#F3F1EC"} />
      <path
        d="M12 16h8M20.2 11.6l-8.4 3.6M20.2 20.4l-8.4-3.6"
        stroke={invert ? "#1F4D45" : "#F3F1EC"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  invert = false,
  compact = false,
}: {
  invert?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark invert={invert} className="size-8 shrink-0" />
      {compact ? null : (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            invert ? "text-sidebar-fg" : "text-ink",
          )}
        >
          Link Mate
        </span>
      )}
    </div>
  );
}

/** Header/footer brand. Always the public home, never nested in another control. */
export function BrandLink({
  invert = false,
  compact = false,
  className,
}: {
  invert?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      aria-label="Link Mate home"
      className={cn("inline-flex min-w-0 shrink-0 items-center", className)}
    >
      <Wordmark invert={invert} compact={compact} />
    </Link>
  );
}
