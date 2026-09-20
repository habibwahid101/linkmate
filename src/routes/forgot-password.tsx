import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const t = useT();
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
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSub")}
    >
      {done ? (
        <p className="text-sm text-muted">
          {t("auth.sent")}{" "}
          <Link to="/login" className="font-medium text-ink underline">
            {t("auth.signin")}
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("auth.send") : t("auth.send")}
          </Button>
          <p className="text-center text-sm text-muted">
            <Link to="/login" className="underline-offset-4 hover:underline">
              {t("auth.signin")}
            </Link>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
