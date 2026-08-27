import { remainingHoldMs } from "@/lib/ui/min-pending";
import { useEffect, useRef, useState } from "react";

/** True while `pending` is true, and for any unused remainder of `minMs`. Cached hits stay instant. */
export function useMinPending(pending: boolean, minMs = 180): boolean {
  const startedAt = useRef<number | null>(null);
  const [hold, setHold] = useState(pending);

  useEffect(() => {
    if (pending) {
      if (startedAt.current == null) startedAt.current = Date.now();
      setHold(true);
      return;
    }
    const wait = remainingHoldMs(startedAt.current, Date.now(), false, minMs);
    startedAt.current = null;
    if (wait === 0) {
      setHold(false);
      return;
    }
    const timer = window.setTimeout(() => setHold(false), wait);
    return () => window.clearTimeout(timer);
  }, [pending, minMs]);

  return pending || hold;
}
