import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WifiOff } from "lucide-react";

export function QueryError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <Card className="flex flex-col items-center py-10 text-center">
      {offline ? <WifiOff className="mb-3 size-6 text-muted" /> : null}
      <p className="font-semibold">{offline ? "You’re offline" : "Couldn’t load this"}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {offline ? "Reconnect to refresh live balances and progress." : message}
      </p>
      {retry ? (
        <Button className="mt-5" variant="outline" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function NoAccess() {
  return (
    <Card className="py-12 text-center">
      <p className="font-semibold">No access</p>
      <p className="mt-1 text-sm text-muted">This area is limited to administrators.</p>
    </Card>
  );
}
