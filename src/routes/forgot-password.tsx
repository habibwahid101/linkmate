import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useState } from "react";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });
      if (result.error) {
        setError("Could not start a password reset. Try again later.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not start a password reset. Try again later.");
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Reset password"
      subtitle="We will email a reset link if that address has an account. Email delivery requires Amazon SES."
    >
      {done ? (
        <p className="text-sm text-muted">
          If an account exists for that email, a reset link will be sent when email is configured.{" "}
          <Link to="/login" className="font-medium text-ink underline">
            Back to sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted">
            <Link to="/login" className="underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
