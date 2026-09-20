import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string; invert?: boolean }) {
  return (
    <img
      src="/logo-mark.png"
      srcSet="/logo-mark.png 1x, /logo-mark@2x.png 2x"
      alt="Link Mate"
      width={66}
      height={48}
      draggable={false}
      className={cn("lm-logo", className)}
    />
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
    <div className="flex shrink-0 items-center gap-2 overflow-visible">
      <LogoMark />
      {compact ? null : (
        <span
          className={cn(
            "hidden whitespace-nowrap text-[15px] font-semibold tracking-tight min-[360px]:inline",
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
      className={cn("inline-flex shrink-0 items-center overflow-visible", className)}
    >
      <Wordmark invert={invert} compact={compact} />
    </Link>
  );
}
