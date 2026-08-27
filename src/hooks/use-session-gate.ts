import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMinPending } from "@/hooks/use-min-pending";
import { useEffect, useState } from "react";

/**
 * Session is treated as unresolved until Better Auth has produced one settled
 * result. That blocks a first-paint signed-out/login flash on hard refresh.
 */
export function useSessionGate() {
  const { user, isPending } = useCurrentUserState();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!isPending) setSettled(true);
  }, [isPending]);
  const waiting = isPending || !settled;
  const hold = useMinPending(waiting);
  return { user, isPending: hold, settled: settled && !isPending };
}
