import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  variant = "outline",
  size = "sm",
}: {
  value: string;
  label?: string;
  variant?: "outline" | "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "Copied" : label}
    </Button>
  );
}
