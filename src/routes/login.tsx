import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, grokBrokerEnabled, signIn } from "@/lib/auth/client";
import { useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) {
    void navigate({ to: "/app" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) throw new Error(err.message ?? "Sign-in failed");
      window.location.href = "/app";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Too many")
          ? t("auth.tooMany")
          : t("auth.bad"),
      );
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={t("auth.loginTitle")} subtitle={t("auth.loginSub")}>
      {!authEnabled ? (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password" className="mb-0">
                  {t("auth.password")}
                </Label>
                <Link to="/forgot-password" className="text-xs text-muted hover:text-ink">
                  {t("auth.forgot")}
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t("auth.signing") : t("auth.signin")}
            </Button>
          </form>
          {grokBrokerEnabled ? (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: "/app" })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          <p className="mt-6 text-center text-sm text-muted">
            {t("auth.new")}{" "}
            <Link to="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
              {t("auth.create")}
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  );
}
