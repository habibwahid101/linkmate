import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/reset-password")({ component: Reset });

function Reset() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError("This reset link is invalid or expired.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("This reset link is invalid or expired.");
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" subtitle="Use at least 8 characters.">
      {!token ? (
        <p className="text-sm text-muted">
          Missing reset token. Request a new link from{" "}
          <Link to="/forgot-password" className="underline">
            forgot password
          </Link>
          .
        </p>
      ) : done ? (
        <p className="text-sm text-muted">
          Password updated.{" "}
          <Link to="/login" className="font-medium text-ink underline">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
