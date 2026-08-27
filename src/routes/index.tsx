import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BookingSheet } from "@/components/booking-sheet";
import { LEVELS, STANDARD_ID_VALUE_BDT, fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  Landmark,
  Layers,
  Scale,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

const NAV = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#land-benefit", label: "Land Benefit" },
  { href: "#levels", label: "Levels" },
  { href: "#faq", label: "FAQ" },
] as const;

const LAND_BENEFIT_POINTS = [
  "1 Katha land benefit after qualification",
  "1 Membership ID = ৳11,000",
  "Personally sponsor 3 members",
  "Successfully complete Level 9",
] as const;

function Landing() {
  const { isPending, user } = useCurrentUserState();
  const [book, setBook] = useState(false);
  const [menu, setMenu] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 min-[375px]:px-4 sm:gap-3 sm:px-6">
          <Link to="/" aria-label="Link Mate home" className="min-w-0 shrink-0">
            <Wordmark compact={false} />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Page">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-11 items-center px-3 text-sm font-medium text-muted hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1 min-[375px]:gap-1.5 sm:gap-2">
            <SignedOut>
              <Link
                to="/login"
                className="inline-flex h-11 shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium text-ink/70 hover:text-ink min-[375px]:px-2.5 sm:px-3"
              >
                Login
              </Link>
              <Button size="sm" className="shrink-0" onClick={() => setBook(true)}>
                Book Now
              </Button>
            </SignedOut>
            <SignedIn>
              <Link
                to="/app"
                className="inline-flex h-11 shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium text-ink/70 hover:text-ink min-[375px]:px-2.5 lg:hidden"
              >
                Dashboard
              </Link>
              <Link to="/app" className="hidden lg:inline-flex">
                <Button size="sm" variant="outline">
                  Open dashboard
                </Button>
              </Link>
              <Button size="sm" className="shrink-0" onClick={() => setBook(true)}>
                Book Now
              </Button>
            </SignedIn>
            {isPending ? <div className="h-9 w-16 animate-pulse rounded-[10px] bg-surface-2 min-[375px]:w-20" /> : null}
            <button
              type="button"
              className="grid size-10 shrink-0 place-items-center rounded-[12px] hover:bg-surface-2 min-[375px]:size-11 lg:hidden"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <MenuToggleIcon open={menu} />
            </button>
          </div>
        </div>
        {menu ? (
          <nav className="overflow-x-hidden border-t border-border bg-surface px-4 py-2 lg:hidden" aria-label="Mobile">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex h-11 items-center text-sm font-medium"
                onClick={() => setMenu(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-8 sm:gap-10 sm:px-6 sm:pt-14 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Link Mate membership · Land benefit · Clear qualification
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              A clear membership path toward 1 Katha land.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Start with 1 Link Mate Membership ID for ৳11,000. Complete the defined qualification
              requirements — personally sponsor 3 members and successfully complete Level 9 — to qualify
              for the 1 Katha land benefit, subject to applicable allocation, documentation, and transfer
              terms.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setBook(true)}>
                Book Now
              </Button>
              <a href="#how-it-works">
                <Button size="lg" variant="outline">
                  See How It Works
                </Button>
              </a>
            </div>
          </div>
          <LandBenefitVisual />
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="Qualification summary">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard kicker="1 Membership ID" title={formatBdt(STANDARD_ID_VALUE_BDT)} body="Standard ID value. Larger packages issue additional IDs at the same unit value." />
            <SummaryCard kicker="Qualification Requirement" title="Sponsor 3 + Complete Level 9" body="Both conditions are mandatory. Progress is visible in your dashboard." />
            <SummaryCard kicker="Qualified Land Benefit" title="1 Katha Land" body="Eligibility is assessed after qualification — not at the moment of purchase." />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Qualification requirements are visible before joining. Commission and land eligibility are tracked
            separately.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { n: "1", t: "Activate Membership", d: "Purchase 1 or more Link Mate membership IDs through an available package." },
              { n: "2", t: "Sponsor 3", d: "Personally sponsor 3 qualifying members to complete the mandatory direct-sponsor requirement." },
              { n: "3", t: "Progress Through Levels", d: "Your generation progress is tracked across Levels 1–9." },
              { n: "4", t: "Complete Level 9", d: "Successfully satisfy the required qualification conditions through Level 9." },
              { n: "5", t: "Land Benefit Eligibility", d: "After qualification is verified, the applicable land allocation and transfer process begins according to the relevant terms and documents." },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <p className="font-mono text-xs font-medium text-accent">Step {s.n}</p>
                <p className="mt-2 text-sm font-semibold">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="land-benefit" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Understand the land benefit before you join.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Land allocation and transfer are subject to the applicable terms and documentation. Buying an ID
            does not immediately transfer ownership.
          </p>
          <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-2">
            <ul className="h-full space-y-4 rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
              {LAND_BENEFIT_POINTS.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"
                    aria-hidden="true"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 text-sm font-medium leading-relaxed text-ink">{line}</span>
                </li>
              ))}
            </ul>
            <div className="flex h-full flex-col rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
              <div className="flex items-center gap-3">
                <Landmark className="size-6 shrink-0 text-accent" strokeWidth={1.75} />
                <p className="min-w-0 text-base font-semibold">View Land Terms & Documents</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Land documents will be available here before final allocation/transfer. We do not publish
                placeholder legal files.
              </p>
              <Button className="mt-6 w-full sm:w-auto" variant="outline" onClick={() => setBook(true)}>
                Book after reading the conditions
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Built around clarity, not hidden conditions.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TrustItem icon={<Scale className="size-5" />} t="Clear Membership Cost" d={`${formatBdt(STANDARD_ID_VALUE_BDT)} per standard ID`} />
            <TrustItem icon={<Users className="size-5" />} t="Clear Qualification" d="Sponsor 3 + Complete Level 9" />
            <TrustItem icon={<Layers className="size-5" />} t="Visible Progress" d="Every level and generation can be tracked" />
            <TrustItem icon={<Wallet className="size-5" />} t="Transparent Commission Status" d="Held and released amounts are shown separately" />
            <TrustItem icon={<BadgeCheck className="size-5" />} t="Generation Integrity" d="Members remain in their actual generation" />
            <TrustItem icon={<BookOpen className="size-5" />} t="Ledger-Based Transactions" d="Financial activity remains traceable" />
            <TrustItem icon={<Landmark className="size-5" />} t="Land Documentation" d="Allocation and transfer documents are available through the qualification process" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Progress you can actually follow.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            After login, the dashboard shows where you are, what is held, what is released, and what to do next.
            Held commission is released after the applicable level is completed.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Current position", d: "Active ID, current level, and direct-sponsor count." },
              { t: "Held vs available", d: "Held commission is not mixed with withdrawable balance." },
              { t: "Land qualification", d: "Sponsor 3 and Level 9 are tracked until both are complete." },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
                <p className="text-sm font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="levels" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Nine levels, actual generations</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            This table is educational. Generation positions are not reclassified when higher levels are reached.
            Commission is calculated on the standard ID value of {formatBdt(STANDARD_ID_VALUE_BDT)}.
          </p>
          <div className="mt-5 overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[36rem] text-sm">
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
          <p className="mt-3 text-xs text-muted">
            Level 1 requires 3 personal sponsors. Members stay in their true generation.
          </p>
        </section>

        <section id="faq" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Questions, answered plainly</h2>
          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-4 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl bg-sidebar px-5 py-10 text-sidebar-fg sm:px-10">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Know the conditions. Track your progress. Start when you are ready.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-sidebar-muted">
              Qualification requirements are visible before joining. There is no artificial scarcity on this page.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setBook(true)}>
                Book Now
              </Button>
              <SignedIn>
                <Link to="/app">
                  <Button size="lg" variant="sidebar">
                    Open dashboard
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm text-muted">
              Membership IDs, generation commission, and a documented land qualification path.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="h-11 inline-flex items-center text-muted hover:text-ink">
                {item.label}
              </a>
            ))}
            <Link to="/login" className="inline-flex h-11 items-center text-muted hover:text-ink">
              Login
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-subtle sm:px-6">
          Land benefit is subject to sponsor-3, Level-9 completion, and applicable allocation, documentation,
          and transfer terms. Commission is held until a level’s required member count is complete.
        </p>
      </footer>

      <BookingSheet open={book} onClose={() => setBook(false)} signedIn={Boolean(user)} />
    </div>
  );
}

function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block size-[18px]" aria-hidden="true">
      <span
        className={cn(
          "absolute left-0 top-1/2 h-[1.75px] origin-center rounded-full bg-ink transition-[transform,width] duration-200 ease-out motion-reduce:transition-none",
          open ? "w-[18px] -translate-y-1/2 rotate-45" : "w-[13px] -translate-y-[4.25px]",
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-1/2 h-[1.75px] origin-center rounded-full bg-ink transition-[transform,width] duration-200 ease-out motion-reduce:transition-none",
          open ? "w-[18px] -translate-y-1/2 -rotate-45" : "w-[18px] translate-y-[2.5px]",
        )}
      />
    </span>
  );
}

function SummaryCard({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{kicker}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function TrustItem({ icon, t, d }: { icon: ReactNode; t: string; d: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{t}</p>
        <p className="mt-1 text-sm text-muted">{d}</p>
      </div>
    </div>
  );
}

function LandBenefitVisual() {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="overflow-hidden rounded-xl bg-accent-soft">
        <LandPlotSchematic />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Land Benefit</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">1 Katha Land</p>
      <p className="mt-1 text-sm text-muted">After successful qualification</p>
      <p className="mt-3 text-sm font-medium text-accent">Sponsor 3 · Complete Level 9</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HeroChip>{`1 ID = ${formatBdt(STANDARD_ID_VALUE_BDT)}`}</HeroChip>
        <HeroChip>Sponsor 3</HeroChip>
        <HeroChip>Level 9</HeroChip>
      </div>
    </div>
  );
}

function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
      {children}
    </span>
  );
}

/** Cadastral-style 1 Katha parcel — one focused plot, not a placeholder grid. */
function LandPlotSchematic() {
  return (
    <svg
      viewBox="0 0 560 220"
      width={560}
      height={220}
      className="block h-auto w-full"
      role="img"
      aria-label="Schematic of a 1 Katha land parcel after qualification"
    >
      <rect width="560" height="220" fill="var(--color-accent-soft)" />
      <path
        d="M0 188 C90 176 170 196 280 184 C390 172 470 198 560 186 L560 220 L0 220 Z"
        fill="var(--color-accent)"
        opacity="0.08"
      />
      <g fill="var(--color-accent)" opacity="0.16">
        <ellipse cx="64" cy="52" rx="18" ry="10" />
        <ellipse cx="88" cy="58" rx="13" ry="8" />
        <ellipse cx="48" cy="62" rx="10" ry="6" />
        <ellipse cx="492" cy="48" rx="16" ry="9" />
        <ellipse cx="516" cy="54" rx="12" ry="7" />
        <ellipse cx="70" cy="168" rx="14" ry="8" />
        <ellipse cx="498" cy="170" rx="18" ry="10" />
        <ellipse cx="522" cy="176" rx="11" ry="6" />
      </g>
      <g transform="translate(172 26)">
        <rect x="5" y="8" width="216" height="148" fill="var(--color-accent)" opacity="0.1" />
        <rect x="0" y="4" width="216" height="148" fill="var(--color-accent)" opacity="0.22" />
        <rect
          x="0"
          y="4"
          width="216"
          height="148"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.25"
        />
        <rect
          x="8"
          y="12"
          width="200"
          height="132"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="0.9"
          strokeDasharray="5 4"
          opacity="0.75"
        />
        <path
          d="M0 4 h14 M0 4 v14 M216 4 h-14 M216 4 v14 M0 152 h14 M0 152 v-14 M216 152 h-14 M216 152 v-14"
          stroke="var(--color-accent)"
          strokeWidth="2.4"
          fill="none"
        />
        <text
          x="108"
          y="78"
          textAnchor="middle"
          fill="var(--color-accent)"
          fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif"
          fontSize="17"
          fontWeight="650"
          letterSpacing="0.04em"
        >
          1 Katha
        </text>
        <text
          x="108"
          y="100"
          textAnchor="middle"
          fill="var(--color-accent)"
          fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif"
          fontSize="11"
          opacity="0.85"
        >
          after qualification
        </text>
      </g>
      <g transform="translate(508 28)" fill="var(--color-accent)">
        <path
          d="M0 18 L0 6 L-3.5 10 M0 6 L3.5 10"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif"
        >
          N
        </text>
      </g>
    </svg>
  );
}

const FAQ = [
  {
    q: "What is a Link Mate Membership ID?",
    a: "A Membership ID is your position in the Link Mate network. Each standard ID is valued at ৳11,000 for commission. IDs are issued when you purchase a package.",
  },
  {
    q: "How much does 1 ID cost?",
    a: "One standard membership ID costs ৳11,000. Builder is 1 ID. Turbo, Super Turbo, and Hyper Turbo issue 4, 13, and 22 IDs at the same unit value.",
  },
  {
    q: "What is required to qualify for the land benefit?",
    a: "Personally sponsor 3 members and successfully complete Level 9. The 1 Katha land benefit is then subject to applicable allocation, documentation, and transfer terms.",
  },
  {
    q: "Is sponsoring 3 members mandatory?",
    a: "Yes. Level 1 requires 3 personal sponsors. That same direct-sponsor requirement is mandatory for land qualification.",
  },
  {
    q: "What does completing Level 9 mean?",
    a: "Level 9 is the 9th generation. Its required member count must be fully met. Commission for that level is held until complete, then released in full. Land qualification also requires this level to be complete.",
  },
  {
    q: "Does buying an ID immediately transfer land ownership?",
    a: "No. Purchase activates membership. Land is a qualified benefit after sponsor-3 and Level 9, then allocation and transfer follow the applicable documents.",
  },
  {
    q: "How are commissions held and released?",
    a: "When a qualifying member joins a generation, commission is added to held (not the wallet). When that level’s required member count is reached, the full accumulated amount releases to available balance. There is no partial wallet release.",
  },
  {
    q: "Can I buy more than one ID?",
    a: "Yes, through the four packages, or by purchasing again later. Each ID tracks its own level progress, held commission, and qualification state.",
  },
  {
    q: "What happens with multiple-ID packages?",
    a: "Internal IDs are placed according to the package structure. An external sponsor attaches to your first ID only and does not earn from the package-created extra IDs.",
  },
  {
    q: "Where can I view land terms and documents?",
    a: "A land terms entry is on this page and in the logged-in Land Qualification module. Documents will be available there before final allocation or transfer. We do not publish placeholder legal files.",
  },
];
