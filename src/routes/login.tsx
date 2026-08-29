import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, grokBrokerEnabled, signIn } from "@/lib/auth/client";
import { useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
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
          ? "Too many attempts. Try again in a few minutes."
          : "Email or password is incorrect.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Sign in" subtitle="Use the email and password for your Link Mate account.">
      {!authEnabled ? (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
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
                  Password
                </Label>
                <Link to="/forgot-password" className="text-xs text-muted hover:text-ink">
                  Forgot password
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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
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
            New to Link Mate?{" "}
            <Link to="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  );
}
