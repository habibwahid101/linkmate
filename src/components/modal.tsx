import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  compact = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "xl";
  compact?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          "relative w-full overflow-y-auto rounded-t-2xl bg-surface shadow-[var(--shadow-float)] sm:rounded-2xl",
          compact ? "max-h-[min(92dvh,52rem)] p-4" : "max-h-[90dvh] p-5",
          size === "xl" ? "max-w-4xl" : "max-w-md",
        )}
      >
        <div className={cn("flex items-start justify-between gap-3", compact ? "mb-3" : "mb-4")}>
          <h2 id="modal-title" className="min-w-0 pt-2 text-base font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-[12px] text-ink hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
