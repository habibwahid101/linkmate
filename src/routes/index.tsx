import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLink } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardKicker, type CardTone } from "@/components/ui/card";
import { BookingSheet } from "@/components/booking-sheet";
import { HeroProjectVisual } from "@/components/hero-project-visual";
import { LocaleSwitch } from "@/components/locale-switch";
import { LEVELS, STANDARD_ID_VALUE_BDT, fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useT } from "@/lib/i18n";
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

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    links: [
      {
        rel: "preload",
        href: "/hero/illustrative-avenue.webp",
        as: "image",
        type: "image/webp",
      },
    ],
  }),
});

const NAV = [
  { href: "#how-it-works", key: "nav.how" },
  { href: "#land-benefit", key: "nav.land" },
  { href: "#levels", key: "nav.levels" },
  { href: "#faq", key: "nav.faq" },
] as const;

const LAND_BENEFIT_KEYS = ["land.p1", "land.p2", "land.p3", "land.p4"] as const;

function Landing() {
  const { isPending, user } = useCurrentUserState();
  const t = useT();
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
      <header className="sticky top-0 z-40 overflow-visible border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 overflow-visible px-3 min-[375px]:px-4 sm:gap-3 sm:px-6">
          <BrandLink />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Page">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-11 items-center rounded-[10px] px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"
              >
                {t(item.key)}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1 min-[375px]:gap-1.5 sm:gap-2">
            <LocaleSwitch compact />
            <SignedOut>
              <Link
                to="/login"
                className="hidden h-11 shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium text-ink/70 hover:text-ink lg:inline-flex lg:px-3"
              >
                {t("nav.login")}
              </Link>
              <Button size="sm" className="hidden shrink-0 lg:inline-flex" onClick={() => setBook(true)}>
                {t("nav.book")}
              </Button>
            </SignedOut>
            <SignedIn>
              <Link to="/app" className="hidden lg:inline-flex">
                <Button size="sm" variant="outline">
                  {t("nav.openDashboard")}
                </Button>
              </Link>
              <Button size="sm" className="hidden shrink-0 lg:inline-flex" onClick={() => setBook(true)}>
                {t("nav.book")}
              </Button>
            </SignedIn>
            {isPending ? <div className="hidden h-9 w-20 animate-pulse rounded-[10px] bg-surface-2 lg:block" /> : null}
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-[12px] hover:bg-surface-2 lg:hidden"
              aria-label={menu ? t("nav.close") : t("nav.menu")}
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
                {t(item.key)}
              </a>
            ))}
            <SignedOut>
              <Link
                to="/login"
                className="flex h-11 items-center text-sm font-medium text-ink/70"
                onClick={() => setMenu(false)}
              >
                {t("nav.login")}
              </Link>
              <div className="py-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMenu(false);
                    setBook(true);
                  }}
                >
                  {t("nav.book")}
                </Button>
              </div>
            </SignedOut>
            <SignedIn>
              <Link
                to="/app"
                className="flex h-11 items-center text-sm font-medium text-ink/70"
                onClick={() => setMenu(false)}
              >
                {t("nav.dashboard")}
              </Link>
              <div className="py-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMenu(false);
                    setBook(true);
                  }}
                >
                  {t("nav.book")}
                </Button>
              </div>
            </SignedIn>
          </nav>
        ) : null}
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-8 sm:gap-10 sm:px-6 sm:pt-14 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 min-w-0 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {t("hero.kicker")}
            </p>
            <h1 className="lm-hero-title mt-4 max-w-xl font-semibold tracking-tight">
              <span className="block whitespace-nowrap">{t("hero.line1")}</span>
              <span className="block whitespace-nowrap">
                {t("hero.toward")} <span className="lm-land-highlight">1 Decimal Land</span>.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              {t("hero.sub")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <HeroChip>{`1 ID = ${formatBdt(STANDARD_ID_VALUE_BDT)}`}</HeroChip>
              <HeroChip>{t("hero.chip.sponsor")}</HeroChip>
              <HeroChip>{t("hero.chip.level9")}</HeroChip>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setBook(true)}>
                {t("nav.book")}
              </Button>
              <a href="#how-it-works">
                <Button size="lg" variant="outline">
                  {t("hero.howCta")}
                </Button>
              </a>
            </div>
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <HeroProjectVisual />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="Qualification summary">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              tone="package"
              kicker={t("sum.id")}
              title={formatBdt(STANDARD_ID_VALUE_BDT)}
              body={t("sum.idBody")}
            />
            <SummaryCard
              tone="progress"
              kicker={t("sum.req")}
              title={t("sum.reqTitle")}
              body={t("sum.reqBody")}
            />
            <SummaryCard
              tone="success"
              kicker={t("sum.land")}
              title="1 Decimal Land"
              body={t("sum.landBody")}
            />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("how.title")}</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
            {t("how.lead")}
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { n: "1", t: t("how.s1"), d: t("how.s1d"), tone: "package" as const },
              { n: "2", t: t("how.s2"), d: t("how.s2d"), tone: "info" as const },
              { n: "3", t: t("how.s3"), d: t("how.s3d"), tone: "progress" as const },
              { n: "4", t: t("how.s4"), d: t("how.s4d"), tone: "progress" as const },
              { n: "5", t: t("how.s5"), d: t("how.s5d"), tone: "success" as const },
            ].map((s) => (
              <li key={s.n}>
                <Card tone={s.tone} className="h-full p-4 sm:p-4">
                  <p className="font-mono text-xs font-medium text-accent">{t("how.step")} {s.n}</p>
                  <p className="mt-2 text-[15px] font-semibold">{s.t}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.d}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section id="land-benefit" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("land.title")}</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
            {t("land.lead")}
          </p>
          <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-2">
            <Card tone="success" className="h-full space-y-4 p-5 sm:p-6">
              {LAND_BENEFIT_KEYS.map((key) => (
                <div key={key} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"
                    aria-hidden="true"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 text-[15px] font-medium leading-relaxed text-ink">{t(key)}</span>
                </div>
              ))}
            </Card>
            <Card tone="info" className="flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Landmark className="size-6 shrink-0 text-info" strokeWidth={1.75} />
                <p className="min-w-0 text-base font-semibold">{t("land.docs")}</p>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {t("land.docsBody")}
              </p>
              <Button className="mt-6 w-full sm:w-auto" variant="outline" onClick={() => setBook(true)}>
                {t("land.book")}
              </Button>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("trust.title")}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TrustItem tone="package" icon={<Scale className="size-5" />} t={t("trust.cost")} d={`${formatBdt(STANDARD_ID_VALUE_BDT)} ${t("trust.costD")}`} />
            <TrustItem tone="progress" icon={<Users className="size-5" />} t={t("trust.qual")} d={t("trust.qualD")} />
            <TrustItem tone="progress" icon={<Layers className="size-5" />} t={t("trust.progress")} d={t("trust.progressD")} />
            <TrustItem tone="held" icon={<Wallet className="size-5" />} t={t("trust.commission")} d={t("trust.commissionD")} />
            <TrustItem tone="info" icon={<BadgeCheck className="size-5" />} t={t("trust.tree")} d={t("trust.treeD")} />
            <TrustItem tone="info" icon={<BookOpen className="size-5" />} t={t("trust.ledger")} d={t("trust.ledgerD")} />
            <TrustItem tone="success" icon={<Landmark className="size-5" />} t={t("trust.docs")} d={t("trust.docsD")} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("follow.title")}</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
            {t("follow.lead")}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card tone="info" className="p-5">
              <p className="text-[15px] font-semibold">{t("follow.pos")}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{t("follow.posD")}</p>
            </Card>
            <Card tone="held" className="p-5">
              <p className="text-[15px] font-semibold">{t("follow.held")}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{t("follow.heldD")}</p>
            </Card>
            <Card tone="success" className="p-5">
              <p className="text-[15px] font-semibold">{t("follow.land")}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{t("follow.landD")}</p>
            </Card>
          </div>
        </section>

        <section id="levels" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("levels.title")}</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
            {t("levels.lead")} {formatBdt(STANDARD_ID_VALUE_BDT)}.
          </p>
          <Card tone="progress" className="mt-5 overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border-progress text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">{t("levels.level")}</th>
                  <th className="px-4 py-3 font-medium">{t("levels.generation")}</th>
                  <th className="px-4 py-3 font-medium">{t("levels.members")}</th>
                  <th className="px-4 py-3 font-medium">{t("levels.rate")}</th>
                  <th className="px-4 py-3 font-medium">{t("levels.release")}</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l.level} className="border-b border-border-progress/70 last:border-0">
                    <td className="px-4 py-2.5">{l.level}</td>
                    <td className="px-4 py-2.5">{l.generationLabel}</td>
                    <td className="px-4 py-2.5 tabular">{l.requiredMembers}</td>
                    <td className="px-4 py-2.5">{l.rateLabel}</td>
                    <td className="px-4 py-2.5 tabular">{formatBdt(fullLevelCommission(l.level))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            {t("levels.note")}
          </p>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("faq.title")}</h2>
          <Card className="mt-6 divide-y divide-border overflow-hidden p-0 sm:p-0">
            {FAQ_KEYS.map((i) => (
              <details key={i} className="group px-4 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  {t(`faq.${i}.q`)}
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-[15px] leading-relaxed text-muted">{t(`faq.${i}.a`)}</p>
              </details>
            ))}
          </Card>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl bg-surface-available px-5 py-10 text-ink shadow-[0_0_0_1px_var(--color-border-available)] sm:px-10">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("cta.title")}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              {t("cta.lead")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setBook(true)}>
                {t("nav.book")}
              </Button>
              <SignedIn>
                <Link to="/app">
                  <Button size="lg" variant="outline">
                    {t("nav.openDashboard")}
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
            <BrandLink />
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
              {t("footer.blurb")}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="inline-flex h-11 items-center text-muted hover:text-ink">
                {t(item.key)}
              </a>
            ))}
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-subtle sm:px-6">
          {t("footer.legal")}
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
          "absolute left-0 h-[1.75px] w-[18px] origin-center rounded-full bg-ink transition-transform duration-200 ease-out motion-reduce:transition-none",
          open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[2px]",
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-1/2 h-[1.75px] w-[18px] -translate-y-1/2 rounded-full bg-ink transition-opacity duration-200 ease-out motion-reduce:transition-none",
          open ? "opacity-0" : "opacity-100",
        )}
      />
      <span
        className={cn(
          "absolute left-0 h-[1.75px] w-[18px] origin-center rounded-full bg-ink transition-transform duration-200 ease-out motion-reduce:transition-none",
          open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[2px]",
        )}
      />
    </span>
  );
}

function SummaryCard({
  kicker,
  title,
  body,
  tone = "default",
}: {
  kicker: string;
  title: string;
  body: string;
  tone?: CardTone;
}) {
  return (
    <Card tone={tone} className="p-5">
      <CardKicker tone={tone}>{kicker}</CardKicker>
      <p className="mt-2 text-xl font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
    </Card>
  );
}

function TrustItem({
  icon,
  t,
  d,
  tone = "default",
}: {
  icon: ReactNode;
  t: string;
  d: string;
  tone?: CardTone;
}) {
  return (
    <Card tone={tone} className="flex gap-3 p-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface text-ink">{icon}</div>
      <div>
        <p className="text-[15px] font-semibold">{t}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
      </div>
    </Card>
  );
}

function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent">
      {children}
    </span>
  );
}

const FAQ_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
