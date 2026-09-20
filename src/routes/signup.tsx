import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, grokBrokerEnabled, signIn } from "@/lib/auth/client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const t = useT();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromUrl = search?.get("ref");
    const stored = window.localStorage.getItem("lm-ref");
    setReferral((fromUrl || stored || "").toUpperCase());
    const pkg = search?.get("pkg");
    if (pkg) window.localStorage.setItem("lm-pkg", pkg);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (referral) window.localStorage.setItem("lm-ref", referral.toUpperCase());
      const { error: err } = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: "/app/packages",
      });
      if (err) throw new Error("Could not create account");
      window.location.href = "/app/packages";
    } catch {
      setError(t("auth.signupFail"));
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={t("auth.signupTitle")} subtitle={t("auth.signupSub")}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
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
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="ref">{t("auth.referral")}</Label>
          <Input
            id="ref"
            value={referral}
            onChange={(e) => setReferral(e.target.value.toUpperCase())}
            placeholder="e.g. RAFI4K"
            autoCapitalize="characters"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("auth.creating") : t("auth.createCta")}
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
                onClick={() => {
                  if (referral) window.localStorage.setItem("lm-ref", referral.toUpperCase());
                  void signIn(p.providerId, { callbackURL: "/app" });
                }}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        </>
      ) : null}
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.have")}{" "}
        <Link to="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          {t("auth.signin")}
        </Link>
      </p>
    </AuthFrame>
  );
}
