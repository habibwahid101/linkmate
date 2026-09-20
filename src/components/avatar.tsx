import { cn, initials } from "@/lib/utils";

export function AccountAvatar({
  name,
  src,
  size = "md",
  invert = false,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  invert?: boolean;
}) {
  const dim = size === "lg" ? "size-16 text-lg" : size === "sm" ? "size-9 text-xs" : "size-11 text-sm";
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} profile photo` : "Profile photo"}
        className={cn("shrink-0 rounded-full object-cover", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        dim,
        invert ? "bg-white/10 text-sidebar-fg" : "bg-accent-soft text-accent",
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
