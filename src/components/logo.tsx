import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string; invert?: boolean }) {
  return (
    <img
      src="/logo-mark.png"
      srcSet="/logo-mark.png 1x, /logo-mark@2x.png 2x"
      alt=""
      width={40}
      height={32}
      draggable={false}
      className={cn("h-8 w-auto max-h-8 shrink-0 object-contain sm:h-9 sm:max-h-9", className)}
      style={{ height: 32, width: "auto", maxHeight: 36 }}
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
    <div className="flex items-center gap-2">
      <LogoMark className="shrink-0" />
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
