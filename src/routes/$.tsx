import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLink } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$")({ component: NotFound });

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <BrandLink />
      <h1 className="mt-8 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">That link doesn’t exist. Head back to the app or the home page.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button variant="outline">Home</Button>
        </Link>
        <Link to="/app">
          <Button>Open app</Button>
        </Link>
      </div>
    </main>
  );
}
