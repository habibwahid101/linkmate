import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { PACKAGE_LIST, LEVELS, fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut } from "@/lib/auth/gates";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { isPending } = useCurrentUserState();
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <SignedOut>
            <Link to="/login" className="hidden h-11 items-center px-3 text-sm font-medium text-muted hover:text-ink sm:inline-flex">
              Sign in
            </Link>
            <Link to="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to="/app">
              <Button size="sm">Open app</Button>
            </Link>
          </SignedIn>
          {isPending ? <div className="h-9 w-24 animate-pulse rounded-[10px] bg-surface-2" /> : null}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Membership · Generation commission</p>
          <h1 className="mt-3 max-w-xl text-[2rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Membership you can read at a glance.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
            Four packages. One ID value. Commission is held until a level is complete — then the full amount releases to the wallet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button>Create account</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {PACKAGE_LIST.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">{pkg.name}</p>
                <p className="mt-2 whitespace-nowrap tabular text-lg font-semibold tracking-tight sm:text-2xl">{formatBdt(pkg.amountBdt)}</p>
                <p className="mt-1 text-sm text-muted">
                  {pkg.idCount} ID{pkg.idCount === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">How commission moves</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              { t: "Generate", d: "A qualifying member joins a generation." },
              { t: "Hold", d: "The amount is added to held commission — not the wallet." },
              { t: "Complete", d: "The level’s required member count is reached." },
              { t: "Release", d: "The full accumulated level amount posts to available balance." },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <p className="text-sm font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">Nine levels, actual generations</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Members stay in their true generation. Completing Level 3 does not reclassify 1st or 2nd generation members.
          </p>
          <div className="mt-5 overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Generation</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Full release</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l.level} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{l.level}</td>
                    <td className="px-4 py-2.5">{l.generationLabel}</td>
                    <td className="px-4 py-2.5 tabular">{l.requiredMembers}</td>
                    <td className="px-4 py-2.5">{l.rateLabel}</td>
                    <td className="px-4 py-2.5 tabular">{formatBdt(fullLevelCommission(l.level))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Standard ID value ৳11,000. Level 1 requires 3 personal sponsors.</p>
        </section>
      </main>
    </div>
  );
}
